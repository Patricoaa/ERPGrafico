"use client"

import React, { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { PricingRuleInitialData } from "@/types/forms"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form,
    FormField
} from "@/components/ui/form"
import { CancelButton, LabeledInput, LabeledSelect, LabeledSwitch, LabeledContainer, PeriodValidationDateInput, FormSection, FormFooter, FormSplitLayout } from "@/components/shared"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { Tags, Layers, Zap, DollarSign, Calendar } from "lucide-react"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

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

interface UoM {
    id: number
    name: string
    category: number
    ratio: number
}

type FormValues = z.infer<typeof formSchema>

interface PricingRuleFormProps {
    auditSidebar?: React.ReactNode
    initialData?: PricingRuleInitialData
    onSuccess?: () => void
    open: boolean
    onOpenChange: (open: boolean) => void
    productId?: number
    productName?: string
}

export function PricingRuleForm({ auditSidebar, initialData, onSuccess, open, onOpenChange, productId, productName }: PricingRuleFormProps) {
    const [uoms, setUoms] = useState<UoM[]>([])
    const [selectedProductObj, setSelectedProductObj] = useState<any>(null)

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const uomRes = await api.get('/inventory/uoms/')
                setUoms(uomRes.data.results || uomRes.data)
            } catch (error) {
                console.error("Error fetching data", error)
            }
        }
        if (open) fetchData()
    }, [open])

    async function onSubmit(values: FormValues) {
        try {
            const payload = { ...values }
            if (payload.product === null) delete (payload as any).product
            if (payload.uom === null) delete (payload as any).uom
            if (payload.operator !== "BT") delete (payload as any).max_quantity

            if (initialData) {
                await api.put(`/inventory/pricing-rules/${initialData.id}/`, payload)
                toast.success("Regla actualizada correctamente")
            } else {
                await api.post("/inventory/pricing-rules/", payload)
                toast.success("Regla creada correctamente")
            }
            onSuccess?.()
            onOpenChange?.(false)
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar la regla")
        }
    }

    const renderGeneralTab = () => (
        <div className="space-y-6">
            <FormSection title="Alcance y Referencia" icon={Layers} />
            <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <LabeledInput label="Nombre de la Regla" placeholder="Ej: Descuento Mayorista" {...field} />
                        )}
                    />
                </div>
                <div className="col-span-1">
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                            <LabeledInput label="Prioridad" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        )}
                    />
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                    <FormField
                        control={form.control}
                        name="product"
                        render={({ field }) => (
                            <ProductSelector
                                label="Producto Específico (Opcional)"
                                value={field.value?.toString() || null}
                                onChange={(val) => {
                                    field.onChange(val ? parseInt(val) : null)
                                    if (!val) setSelectedProductObj(null)
                                }}
                                onSelect={(p) => setSelectedProductObj(p)}
                                disabled={!!productId}
                                placeholder="Si no se selecciona, aplica a todos"
                            />
                        )}
                    />
                </div>
                <div className="col-span-1">
                    <FormField
                        control={form.control}
                        name="uom"
                        render={({ field }) => (
                            <UoMSelector
                                label="Unidad (Filtro)"
                                variant="standalone"
                                product={selectedProductObj}
                                context="sale"
                                uoms={uoms}
                                value={field.value?.toString() || ""}
                                onChange={(val) => field.onChange(val ? parseInt(val) : null)}
                            />
                        )}
                    />
                </div>
            </div>
        </div>
    )

    const renderConditionsTab = () => (
        <div className="space-y-6">
            <FormSection title="Condición de Activación" icon={Zap} />
            <div className={cn("grid gap-4", operator === "BT" ? "grid-cols-3" : "grid-cols-2")}>
                <FormField
                    control={form.control}
                    name="operator"
                    render={({ field }) => (
                        <LabeledSelect
                            label="Cuando la Cantidad es..."
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
                        <LabeledInput label={operator === "BT" ? "Desde" : "Cantidad"} type="number" {...field} />
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
            <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4">
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
                                className={cn(field.value ? "bg-success/5 border-success/20 shadow-sm" : "border-dashed")}
                            />
                        )}
                    />
                </div>
                <div className="col-span-2">
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
                                label="Válida Desde"
                                validationType="tax"
                                required
                            />
                        )}
                    />

                </div>
                <div className="col-span-2">
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
                            />
                        )}
                    />
                </div>
            </div>


        </div>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={initialData ? "xl" : "lg"}
            hideScrollArea={true}
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-3">
                    <Tags className="h-5 w-5 text-muted-foreground" />
                    <span>{initialData ? "Ficha de Regla de Precio" : "Nueva Regla de Precio"}</span>
                </div>
            }
            description={
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
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton type="submit" form="pricing-rule-form">
                                {initialData ? "Actualizar" : "Crear"} Regla
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <FormSplitLayout
                showSidebar={!!initialData?.id}
                sidebar={auditSidebar}
                className="px-4 pb-4 pt-0"
            >
                <Form {...form}>
                    <form id="pricing-rule-form" onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                        <div className="space-y-6">
                            {renderValidityTab()}
                            {renderGeneralTab()}
                            {renderConditionsTab()}
                            {renderActionsTab()}


                        </div>
                    </form>
                </Form>
            </FormSplitLayout>
        </BaseModal>
    )
}
