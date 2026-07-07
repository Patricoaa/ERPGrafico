"use client"

import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSwitch, FormSection, LabeledSelect } from "@/components/shared"
import { DollarSign, Zap } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { type ProductFormValues } from "./schema"
import { useVatRate } from '@/hooks/useVatRate'
import { PricingUtils } from "@/lib/pricing-utils"
import { cn } from "@/lib/utils"
import { type UoM } from "@/types/entities"

interface ProductPricingSectionProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: unknown
    canBeSold: boolean
    uoms: UoM[]
}

export function ProductPricingSection({ form, canBeSold, uoms }: ProductPricingSectionProps) {
    const { rate } = useVatRate()
    const isDynamicPricing = form.watch("is_dynamic_pricing")
    const productType = form.watch("product_type")
    const allowedSaleUomStrings = form.watch("allowed_sale_uoms") || []
    const allowedSaleUomIds = allowedSaleUomStrings.map(Number).filter(Boolean)

    // Generar opciones para el selector basadas en las UoM permitidas
    const allowedSaleUomsOptions = uoms
        .filter(u => allowedSaleUomIds.includes(u.id))
        .map(u => ({ value: String(u.id), label: u.name }))

    const handleNetChange = (value: string) => {
        const net = parseFloat(value) || 0
        form.setValue("sale_price_gross", PricingUtils.netToGross(net), { shouldDirty: true, shouldValidate: true })
    }

    const handleGrossChange = (value: string) => {
        const gross = parseFloat(value) || 0
        form.setValue("sale_price", PricingUtils.grossToNet(gross), { shouldDirty: true, shouldValidate: true })
    }

    const salePrice = Number(form.watch("sale_price")) || 0
    const salePriceGross = Number(form.watch("sale_price_gross")) || 0
    const taxAmount = salePriceGross - salePrice

    return (
        <div className={cn(
            "space-y-4 animate-in fade-in duration-300",
            (!canBeSold || productType === 'SUBSCRIPTION') && "hidden"
        )}>
            <FormSection title="Precio de Venta" icon={DollarSign} />

            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="is_dynamic_pricing"
                    render={({ field }) => (
                        <LabeledSwitch
                            label="Precio Dinámico"
                            description="Permite definir el precio al momento de la venta (ideal para servicios o productos a medida)"
                            checked={field.value}
                            onCheckedChange={(val) => {
                                form.setValue("is_dynamic_pricing", val, { shouldDirty: true, shouldValidate: false })
                            }}
                            icon={<Zap className="h-4 w-4" />}
                            color="warning"
                        />
                    )}
                />

                <div className={cn("p-6 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center", !isDynamicPricing && "hidden")}>
                    <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center mb-3">
                        <Zap className="h-5 w-5 text-warning" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Modo de Precio Abierto</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[350px]">
                        El precio se solicitará al operador durante el proceso de facturación o venta. Las reglas de precios y descuentos por volumen están deshabilitadas.
                    </p>
                </div>

                {/* Base price row */}
                <div className={cn(isDynamicPricing && "hidden")}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-md items-end">
                        <FormField
                            control={form.control}
                            name="sale_price"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Precio Neto"
                                    type="number"
                                    placeholder="0"
                                    error={fieldState.error?.message}
                                    className="h-9 font-black text-right"
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e)
                                        handleNetChange(e.target.value)
                                    }}
                                />
                            )}
                        />

                        <LabeledInput
                            label={`IVA (${rate}%)`}
                            value={PricingUtils.formatCurrency(taxAmount)}
                            readOnly
                            className="h-9 text-right bg-info/5 border-info/20 text-info/80 cursor-default font-bold"
                        />

                        <FormField
                            control={form.control}
                            name="sale_price_gross"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Precio Bruto"
                                    type="number"
                                    placeholder="0"
                                    error={fieldState.error?.message}
                                    className="h-9 font-black text-right bg-primary/5 border-primary/20"
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e)
                                        handleGrossChange(e.target.value)
                                    }}
                                />
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="sale_uom"
                            render={({ field }) => (
                                <LabeledSelect
                                    label="Unidad Base de Venta"
                                    placeholder={allowedSaleUomsOptions.length === 0 ? "Configure en Logística" : "Seleccione UoM..."}
                                    options={allowedSaleUomsOptions}
                                    value={field.value ? String(field.value) : ""}
                                    onChange={(val) => field.onChange(val ? Number(val) : null)}
                                    disabled={allowedSaleUomsOptions.length === 0}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
