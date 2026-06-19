"use client"

import { useState } from "react"
import {useForm, SubmitHandler} from "react-hook-form"
import { Product } from "@/types/entities"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSelect, FormSection, SkeletonShell } from "@/components/shared"
import { Checkbox } from "@/components/ui/checkbox"
import {Save, DollarSign, AlertCircle} from "lucide-react"
import { useVatRate } from '@/hooks/useVatRate'
import { useUoMs } from "../../hooks/useUoMs"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ALL_PRICE_MODE_OPTIONS = [
    { label: '--- Mantener actual ---', value: 'none' },
    { label: 'Hereda del template', value: 'INHERIT' },
    { label: 'Precio propio', value: 'OVERRIDE' },
    { label: 'Template + sobrecargo', value: 'SURCHARGE' },
]
const INHERIT_ONLY_MODE_OPTIONS = [
    { label: '--- Mantener actual ---', value: 'none' },
    { label: 'Hereda del template', value: 'INHERIT' },
]

const bulkEditSchema = z.object({
    sale_price: z.string().optional(),
    sale_uom: z.string().optional(),
    price_inheritance_mode: z.string().optional(),
    price_surcharge: z.string().optional(),
    has_bom: z.boolean().default(false),
    apply_has_bom: z.boolean().default(false),
    copy_bom_from: z.string().optional(),
})

type BulkEditValues = z.infer<typeof bulkEditSchema>

interface BulkVariantEditFormProps {
    selectedVariants: Product[]
    availableVariants?: Product[]
    templateData?: Product
    onSaved: (updatedVariants: Product[]) => void
    onCancel: () => void
}

export function BulkVariantEditForm({ selectedVariants, availableVariants = [], templateData, onSaved, onCancel }: BulkVariantEditFormProps) {
    const [loading, setLoading] = useState(false)
    const { uoms, isLoading: isUoMsLoading } = useUoMs()
    const { rate, multiplier } = useVatRate()

    // If template has UoM-specific prices, only INHERIT is allowed
    const hasUomPrices = Array.isArray((templateData as any)?.uom_prices)
        ? (templateData as any).uom_prices.length > 0
        : false
    const priceModeOptions = hasUomPrices ? INHERIT_ONLY_MODE_OPTIONS : ALL_PRICE_MODE_OPTIONS

    const form = useForm<BulkEditValues>({
        resolver: zodResolver(bulkEditSchema) as any,
        defaultValues: {
            apply_has_bom: false,
            has_bom: true,
            sale_price: "",
            sale_uom: "",
            price_inheritance_mode: "",
            price_surcharge: "",
            copy_bom_from: "",
        }
    })

    const onSubmit: SubmitHandler<BulkEditValues> = async (data) => {
        setLoading(true)
        const payload: Partial<Product> & { copy_bom_from?: number } = {}
        if (data.sale_price !== undefined && data.sale_price !== "") payload.sale_price = Number(data.sale_price)
        if (data.sale_uom !== undefined && data.sale_uom !== "" && data.sale_uom !== "none") payload.sale_uom = Number(data.sale_uom)
        if (data.price_inheritance_mode && data.price_inheritance_mode !== "none") {
            payload.price_inheritance_mode = data.price_inheritance_mode as 'INHERIT' | 'OVERRIDE' | 'SURCHARGE'
            if (data.price_inheritance_mode === 'INHERIT') payload.price_surcharge = null
        }
        // Apply surcharge amount if provided
        if (data.price_surcharge !== undefined && data.price_surcharge !== "") {
            payload.price_surcharge = Number(data.price_surcharge)
            if (!payload.price_inheritance_mode) payload.price_inheritance_mode = 'SURCHARGE'
        }
        if (data.apply_has_bom) {
            payload.has_bom = data.has_bom
            if (data.has_bom) payload.product_type = "MANUFACTURABLE"
        }
        if (data.copy_bom_from && data.copy_bom_from !== "" && data.copy_bom_from !== "none") {
            payload.copy_bom_from = Number(data.copy_bom_from)
            payload.has_bom = true
            payload.product_type = "MANUFACTURABLE"
        }

        if (Object.keys(payload).length === 0) {
            toast.info("No se seleccionaron cambios masivos.")
            setLoading(false)
            return
        }

        const updatedVariants = selectedVariants.map(v => {
            return {
                ...v,
                sale_price: payload.sale_price !== undefined ? payload.sale_price : v.sale_price,
                sale_uom: payload.sale_uom !== undefined ? payload.sale_uom : v.sale_uom,
                has_active_bom: payload.copy_bom_from !== undefined ? true : (payload.has_bom !== undefined ? payload.has_bom : v.has_active_bom),
                product_type: payload.product_type !== undefined ? payload.product_type : v.product_type,
                copy_bom_from: payload.copy_bom_from,
                price_inheritance_mode: payload.price_inheritance_mode ?? v.price_inheritance_mode,
                price_surcharge: payload.price_surcharge !== undefined ? payload.price_surcharge : v.price_surcharge,
            }
        })

        toast.success(`${selectedVariants.length} variantes guardadas.`);
        onSaved(updatedVariants as Product[])
        setLoading(false)
    }

    const currentMode = form.watch('price_inheritance_mode');
    const overrideNetRaw = form.watch('sale_price');
    const overrideNet = parseFloat(overrideNetRaw as string) || 0;
    const currentIva = overrideNetRaw ? overrideNet * (rate / 100) : 0;
    const currentGross = overrideNetRaw ? overrideNet * multiplier : 0;

    const handleOverrideGrossChange = (value: string) => {
        const gross = parseFloat(value) || 0;
        if (!value) {
            form.setValue("sale_price", "", { shouldDirty: true, shouldValidate: true });
            return;
        }
        const net = gross / multiplier;
        form.setValue("sale_price", net.toFixed(2), { shouldDirty: true, shouldValidate: true });
    }

    return (
        <SkeletonShell isLoading={isUoMsLoading} ariaLabel="Cargando edición masiva de variantes">
        <div className="flex flex-col h-full bg-card rounded-md border shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
                <Form {...form}>
                    <form id="bulk-edit-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                        <FormSection title="Precios y Logística" icon={DollarSign} />
                        <FormField<BulkEditValues>
                            control={form.control}
                            name="price_inheritance_mode"
                            render={({ field }) => (
                                <LabeledSelect
                                    label="Modo de Precio"
                                    value={(field.value as string) || "none"}
                                    onChange={(val) => {
                                        field.onChange(val);
                                        if (val !== 'SURCHARGE') form.setValue('price_surcharge', "");
                                        if (val !== 'OVERRIDE') form.setValue('sale_price', "");
                                    }}
                                    options={priceModeOptions}
                                    className="h-10 font-black"
                                    disabled={hasUomPrices}
                                    hint={hasUomPrices ? "Bloqueado: template con precios por UoM" : undefined}
                                />
                            )}
                        />

                        {currentMode === 'SURCHARGE' && !hasUomPrices && (
                            <FormField<BulkEditValues>
                                control={form.control}
                                name="price_surcharge"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        name={field.name}
                                        ref={field.ref}
                                        value={(field.value as string) ?? ""}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        label="Sobrecargo (Neto)"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        error={fieldState.error?.message}
                                        className="h-10 font-bold bg-warning/5 border-warning/20"
                                    />
                                )}
                            />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-2 border-primary/10 rounded-md bg-primary/5">
                            <FormField<BulkEditValues>
                                control={form.control}
                                name="sale_price"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        name={field.name}
                                        ref={field.ref}
                                        value={(field.value as string) ?? ""}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        label="Precio Neto"
                                        type="number"
                                        step="0.01"
                                        placeholder="Mantener actual"
                                        error={fieldState.error?.message}
                                        readOnly={currentMode !== 'OVERRIDE' && currentMode !== 'none'}
                                        className={cn("h-10 font-bold text-right", currentMode !== 'OVERRIDE' && currentMode !== 'none' && "bg-muted/30 cursor-default")}
                                    />
                                )}
                            />
                            <LabeledInput
                                label={`IVA (${rate}%)`}
                                type="number"
                                value={overrideNetRaw ? currentIva.toFixed(2) : ""}
                                placeholder="-"
                                readOnly
                                className="h-10 font-medium text-right bg-muted/20 cursor-default text-muted-foreground"
                            />
                            <LabeledInput
                                label="Precio Bruto"
                                type="number"
                                value={overrideNetRaw ? currentGross.toFixed(2) : ""}
                                placeholder="-"
                                readOnly={currentMode !== 'OVERRIDE' && currentMode !== 'none'}
                                onChange={(e) => handleOverrideGrossChange(e.target.value)}
                                className={cn("h-10 font-black text-right", currentMode !== 'OVERRIDE' && currentMode !== 'none' && "bg-muted/30 cursor-default")}
                            />

                            <FormField<BulkEditValues>
                                control={form.control}
                                name="sale_uom"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Ud. Venta"
                                        value={(field.value as string) || "none"}
                                        onChange={field.onChange}
                                        options={[
                                            { label: "--- Mantener actual ---", value: "none" },
                                            ...uoms.map(u => ({ label: u.name, value: u.id.toString() }))
                                        ]}
                                        error={fieldState.error?.message}
                                        className="h-10"
                                    />
                                )}
                            />
                        </div>

                        {(currentMode === 'INHERIT' || currentMode === 'SURCHARGE') && (templateData as any)?.discount_active && (
                            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md flex gap-2 items-center text-[11px] font-bold text-warning-foreground">
                                <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                                El template tiene descuentos configurados. Estos se aplicarán sobre el precio final calculado para estas variantes.
                            </div>
                        )}
                        <FormSection title="Configuración Industrial" icon={Save} />
                        <div className="space-y-6">
                            <FormField<BulkEditValues>
                                control={form.control}
                                name="apply_has_bom"
                                render={({ field }) => (
                                    <div className={cn(
                                        "flex items-center justify-between p-4 rounded-md border-2 transition-all",
                                        field.value ? "bg-primary/5 border-primary/20" : "bg-background border-dashed border-muted-foreground/20"
                                    )}>
                                        <div className="space-y-1">
                                            <label className="text-xs font-black uppercase tracking-widest text-primary">Sincronizar Requisito de LdM</label>
                                            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Actualizar masivamente si las variantes requieren fabricación.</p>
                                        </div>
                                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} className="h-5 w-5" />
                                    </div>
                                )}
                            />

                            {form.watch("apply_has_bom") && (
                                <FormField<BulkEditValues>
                                    control={form.control}
                                    name="has_bom"
                                    render={({ field }) => (
                                        <div className="flex flex-row items-center justify-between space-x-3 rounded-md border-2 p-4 bg-background animate-in fade-in duration-200">
                                            <div className="space-y-1 leading-none">
                                                <label className="text-xs font-bold uppercase">Requieren Lista de Materiales</label>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">
                                                    Forzará a las {selectedVariants.length} variantes a ser Fabricables.
                                                </p>
                                            </div>
                                            <Checkbox
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                                className="h-5 w-5"
                                            />
                                        </div>
                                    )}
                                />
                            )}

                            <FormField<BulkEditValues>
                                control={form.control}
                                name="copy_bom_from"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Copiar Receta (BOM) desde:"
                                        value={(field.value as string) || ""}
                                        onChange={field.onChange}
                                        options={[
                                            { label: "--- No copiar / Sin cambios ---", value: "none" },
                                            ...availableVariants
                                                .filter(v => v.has_active_bom)
                                                .map(v => ({
                                                    label: `${v.variant_display_name || v.name} (${v.internal_code || v.code})`,
                                                    value: v.id.toString()
                                                }))
                                        ]}
                                        error={fieldState.error?.message}
                                        hint="Elegir una variante origen con LdM configurada para replicarla en todas."
                                        className="h-11 font-black"
                                    />
                                )}
                            />
                        </div>
                    </form>
                </Form>
            </div>
        </div>
        </SkeletonShell>
    )
}
