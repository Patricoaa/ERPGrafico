"use client"

import React, { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { type PricingRuleInitialData } from "@/types/forms"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Form,
    FormField
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { useUoMs } from "@/features/inventory/hooks/useUoMs"
import { usePricingRuleMutations } from "@/features/inventory"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { Layers, Zap, DollarSign, Calendar, Printer } from "lucide-react"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { useSingleProduct } from "@/features/inventory/hooks/useProductSearch"
import { Drawer, CancelButton, LabeledInput, LabeledSelect, LabeledSwitch, PeriodValidationDateInput, FormSection, FormFooter, FormSplitLayout, SkeletonShell, ActionSlideButton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { formDrawerWidth } from "@/lib/form-widths"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"

const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    product: z.number().nullable().optional(),
    uom: z.number().nullable().optional(),
    operator: z.enum(["GT", "LT", "EQ", "GE", "LE", "BT"]),
    min_quantity: z.string().or(z.number()),
    max_quantity: z.string().or(z.number()).nullable().optional(),
    rule_type: z.enum(["FIXED", "DISCOUNT_PERCENTAGE", "PACKAGE_FIXED"]),
    fixed_price: z.string().or(z.number()).nullable().optional(),
    fixed_price_gross: z.string().or(z.number()).nullable().optional(),
    discount_percentage: z.string().or(z.number()).nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    priority: z.number(),
    active: z.boolean(),
})

// Forma local que espera el UoMFilterSelect — ratio es number aquí pero
// el hook useUoMs devuelve string (backend serializa Decimal). Casteamos
// en el punto de uso (línea con uoms={uoms as unknown as ...}).
interface UoM {
    id: number
    name: string
    category: number
    ratio: number
}

type FormValues = z.infer<typeof formSchema>

interface PricingRuleDrawerProps {
    auditSidebar?: React.ReactNode
    initialData?: PricingRuleInitialData
    onSuccess?: () => void
    open: boolean
    onOpenChange: (open: boolean) => void
    productId?: number
    productName?: string
    mode?: DrawerMode
}

export function PricingRuleDrawer({ auditSidebar, initialData, onSuccess, open, onOpenChange, productId, productName, mode: modeProp }: PricingRuleDrawerProps) {
    const { uoms, isUoMsLoading } = useUoMs()
    const { savePricingRule } = usePricingRuleMutations()
    const isFetchingInitialData = open && isUoMsLoading
    const [selectedProductObj, setSelectedProductObj] = useState<any>(null)
    const { product: loadedProduct } = useSingleProduct(productId ?? null)
    const effectiveProduct = selectedProductObj || loadedProduct || null

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            rule_type: "FIXED",
            min_quantity: "1",
            priority: 0,
            active: true,
            product: productId || null,
            uom: null,
            operator: "GE",
            max_quantity: null,
            fixed_price: null,
            discount_percentage: null,
            start_date: null,
            end_date: null,
        },
    })

    const ruleType = form.watch("rule_type")
    const operator = form.watch("operator")

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            if (initialData) {
                const getProductId = (p: unknown): number | null => {
                    if (typeof p === 'number') return p
                    if (typeof p === 'string') return parseInt(p) || null
                    if (p && typeof p === 'object' && 'id' in p) return (p as { id: number }).id || null
                    return null
                }

                form.reset({
                    name: initialData.name || "",
                    rule_type: initialData.rule_type || "FIXED",
                    operator: initialData.operator ?? "GE",
                    min_quantity: initialData.min_quantity !== undefined ? String(initialData.min_quantity) : "1",
                    max_quantity: initialData.max_quantity ? String(initialData.max_quantity) : null,
                    fixed_price: initialData.fixed_price ? String(initialData.fixed_price) : null,
                    fixed_price_gross: initialData.fixed_price_gross ? String(initialData.fixed_price_gross) : null,
                    discount_percentage: initialData.discount_percentage ? String(initialData.discount_percentage) : null,
                    priority: initialData.priority ?? 0,
                    active: initialData.active ?? true,
                    product: getProductId(initialData.product) || productId || null,
                    uom: getProductId(initialData.uom) || null,
                    start_date: initialData.start_date || null,
                    end_date: initialData.end_date || null,
                })
            } else {
                form.reset({
                    name: "",
                    rule_type: "FIXED",
                    min_quantity: "1",
                    priority: 0,
                    active: true,
                    product: productId || null,
                    uom: null,
                    operator: "GE",
                    max_quantity: null,
                    fixed_price: null,
                    fixed_price_gross: null,
                    discount_percentage: null,
                    start_date: null,
                    end_date: null,
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, initialData, productId, form])

    // uoms vienen reactivos de useUoMs (declarado al inicio del componente).

    async function onSubmit(values: FormValues) {
        try {
            const payload = { ...values }
            if (payload.product === null) delete (payload as any).product
            if (payload.uom === null) delete (payload as any).uom
            if (payload.operator !== "BT") delete (payload as any).max_quantity

            // savePricingRule invalida PRICING_RULES + PRODUCTS_KEYS (los precios
            // computados en la lista de productos cambian) automáticamente.
            await savePricingRule({ id: initialData?.id ?? null, payload })
            toast.success(initialData ? "Regla actualizada correctamente" : "Regla creada correctamente")
            onSuccess?.()
            onOpenChange?.(false)
        } catch (error) {
            showApiError(error, "Error al guardar la regla de precio")
        }
    }

    const renderGeneralTab = () => (
        <div className="space-y-6">
            <FormSection title="Alcance y Referencia" icon={Layers} />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <LabeledInput label="Nombre de la Regla" required placeholder="Ej: Descuento Mayorista" {...field} />
                    )}
                />
                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <LabeledInput label="Prioridad" required type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="product"
                    render={({ field }) => (
                        <ProductSelector
                            label="Producto Específico (opcional)"
                            value={field.value?.toString() || null}
                            onChange={(val) => {
                                field.onChange(val ? parseInt(val) : null)
                                if (!val) setSelectedProductObj(null)
                            }}
                            onSelect={(p) => setSelectedProductObj(p)}
                            disabled={!!productId}
                            placeholder="Si no se selecciona, aplica a todos"
                            shouldResolveVariants={false}
                            customFilter={(p: any) => !p.parent_template}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="uom"
                    render={({ field }) => (
                        <UoMSelector
                            label="Unidad (Filtro)"
                            variant="standalone"
                            product={effectiveProduct}
                            context="purchase"
                            uoms={uoms as unknown as UoM[]}
                            value={field.value?.toString() || ""}
                            onChange={(val) => field.onChange(val ? parseInt(val) : null)}
                        />
                    )}
                />
            </div>
        </div>
    )

    const renderConditionsTab = () => (
        <div className="space-y-6">
            <FormSection title="Condición de Activación" icon={Zap} />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="operator"
                    render={({ field }) => (
                        <LabeledSelect
                            label="Cuando la Cantidad es..."
                            required
                            onChange={field.onChange}
                            value={field.value}
                            options={[
                                { value: "GE", label: "Mayor o Igual ( >= )" },
                                { value: "GT", label: "Mayor que ( > )" },
                                { value: "LE", label: "Menor o Igual ( <= )" },
                                { value: "LT", label: "Menor que ( < )" },
                                { value: "EQ", label: "Igual a ( = )" },
                                { value: "BT", label: "En el Rango (Entre)" }
                            ]}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="min_quantity"
                    render={({ field }) => (
                        <LabeledInput label={operator === "BT" ? "Desde" : "Cantidad"} required type="number" {...field} />
                    )}
                />
                {operator === "BT" && (
                    <FormField
                        control={form.control}
                        name="max_quantity"
                        render={({ field }) => (
                            <LabeledInput label="Hasta" type="number" {...field} value={field.value || ""} />
                        )}
                    />
                )}
            </div>
        </div>
    )

    const renderActionsTab = () => (
        <div className="space-y-6">
            <FormSection title="Efecto / Precio Final" icon={DollarSign} />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="rule_type"
                    render={({ field }) => (
                        <LabeledSelect
                            label="Tipo de Ajuste"
                            required
                            onChange={field.onChange}
                            value={field.value}
                            options={[
                                { value: "FIXED", label: "Precio Unitario Fijo" },
                                { value: "PACKAGE_FIXED", label: "Precio de Paquete (Total)" },
                                { value: "DISCOUNT_PERCENTAGE", label: "Porcentaje Descuento" }
                            ]}
                        />
                    )}
                />

                {ruleType === "DISCOUNT_PERCENTAGE" ? (
                    <FormField
                        control={form.control}
                        name="discount_percentage"
                        render={({ field }) => (
                            <LabeledInput label="Descuento (%)" type="number" {...field} value={field.value || ""} />
                        )}
                    />
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={form.control}
                            name="fixed_price"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Precio (Neto)"
                                    type="number"
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val);
                                        if (val) {
                                            const gross = PricingUtils.netToGross(parseFloat(val));
                                            form.setValue("fixed_price_gross", String(gross));
                                        } else {
                                            form.setValue("fixed_price_gross", "");
                                        }
                                    }}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="fixed_price_gross"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Precio (Bruto)"
                                    type="number"
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val);
                                        if (val) {
                                            const net = PricingUtils.grossToNet(parseFloat(val));
                                            form.setValue("fixed_price", String(net));
                                        } else {
                                            form.setValue("fixed_price", "");
                                        }
                                    }}
                                />
                            )}
                        />
                    </div>
                )}
            </div>
        </div>
    )

    const renderValidityTab = () => (
        <div className="space-y-6">
            <FormSection title="Vigencia y Estado" icon={Calendar} />
            <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                    <LabeledSwitch
                        label="Estado de la Regla"
                        description={field.value ? "Regla activa" : "Regla inactiva"}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        icon={<Zap className={cn("h-4 w-4 transition-colors", field.value ? "text-success" : "text-muted-foreground/30")} />}
                        className={cn(field.value ? "bg-success/5 border-success/20 shadow-card" : "border-dashed")}
                    />
                )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                        <PeriodValidationDateInput
                            date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                            onDateChange={(date) => {
                                if (!date) {
                                    field.onChange(null)
                                    return
                                }
                                field.onChange(date.toISOString().split('T')[0])
                            }}
                            label="Válida Desde (opcional)"
                            validationType="tax"
                            required={false}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                        <PeriodValidationDateInput
                            date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                            onDateChange={(date) => {
                                if (!date) {
                                    field.onChange(null)
                                    return
                                }
                                field.onChange(date.toISOString().split('T')[0])
                            }}
                            label="Válida Hasta (Opcional)"
                            validationType="tax"
                            required={false}
                        />
                    )}
                />
            </div>
        </div>
    )

    const drawerTitle = isView
        ? `Ficha de Regla de Precio${initialData?.id ? ` #${initialData.id}` : ""}`
        : mode === 'create'
            ? "Nueva Regla de Precio"
            : "Editar Regla de Precio"

    return (
        <>
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="Pricing Rule"
                    displayId={`#${initialData.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{initialData?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span>{initialData?.rule_type ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("complex", !!initialData)}
                mode={mode}
                title={<span>{drawerTitle}</span>}
                headerActions={(mode === 'view' || mode === 'edit') && initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {initialData?.rule_type && (
                            <>
                                <span>{initialData.rule_type === "FIXED" ? "Monto Fijo" : initialData.rule_type === "PACKAGE_FIXED" ? "Paquete Fijo" : "Descuento"}</span>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <span>{form.watch("name") || "Configuración de regla activa"}</span>
                    </div>
                }
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <ActionSlideButton type="submit" form="pricing-rule-form">
                                    {mode === 'create' ? "Crear Regla" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <FormSplitLayout
                    showSidebar={!!initialData?.id}
                    sidebar={auditSidebar}
                    className="px-4 pb-4 pt-0"
                >
                    <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de regla de precio" className="flex-1 flex flex-col">
                        <Form {...form}>
                            <form id="pricing-rule-form" onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                                <fieldset disabled={isView} className="contents">
                                    <div className="space-y-6">
                                        {renderValidityTab()}
                                        {renderGeneralTab()}
                                        {renderConditionsTab()}
                                        {renderActionsTab()}

                                    </div>
                                </fieldset>
                            </form>
                        </Form>
                    </SkeletonShell>
                </FormSplitLayout>
            </Drawer>
        </>
    )
}
