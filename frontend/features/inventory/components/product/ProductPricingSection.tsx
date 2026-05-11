"use client"

import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSwitch, FormSection, LabeledContainer } from "@/components/shared"
import { Scale, DollarSign, Zap, Info } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { PricingUtils } from "../../utils/pricing"
import { cn } from "@/lib/utils"
import { UoM } from "@/types/entities"
import { Badge } from "@/components/ui/badge"
import { UoMSelector } from "@/components/selectors"

interface ProductPricingSectionProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
    canBeSold: boolean
    uoms: UoM[]
}

export function ProductPricingSection({ form, initialData, canBeSold, uoms }: ProductPricingSectionProps) {
    const isDynamicPricing = form.watch("is_dynamic_pricing")
    const productType = form.watch("product_type")
    const stockUomId = form.watch("uom")
    
    const stockUom = uoms.find(u => u.id.toString() === stockUomId?.toString())
    const uomName = stockUom?.name || "unidad"

    // Sync Net -> Gross
    const handleNetChange = (value: string) => {
        const net = parseFloat(value) || 0
        const gross = PricingUtils.netToGross(net)
        form.setValue("sale_price_gross", gross, { shouldDirty: true, shouldValidate: true })
    }

    // Sync Gross -> Net
    const handleGrossChange = (value: string) => {
        const gross = parseFloat(value) || 0
        const net = PricingUtils.grossToNet(gross)
        form.setValue("sale_price", net, { shouldDirty: true, shouldValidate: true })
    }

    const salePrice = form.watch("sale_price") || 0
    const salePriceGross = form.watch("sale_price_gross") || 0
    const taxAmount = salePriceGross - salePrice

    if (!canBeSold || productType === 'SUBSCRIPTION') return null

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <FormSection 
                title="Precios y Comercialización" 
                icon={Scale} 
            />
            
            <div className="grid grid-cols-4 gap-4 items-start">
                {/* Dynamic Pricing Toggle */}
                <div className="col-span-4">
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="is_dynamic_pricing"
                        render={({ field }) => (
                            <LabeledSwitch
                                label="Precio Dinámico / Variable"
                                description="Permite definir el precio al momento de la venta (ideal para servicios o productos a medida)"
                                checked={field.value}
                                onCheckedChange={(val) => {
                                    requestAnimationFrame(() => {
                                        field.onChange(val)
                                    })
                                }}
                                icon={<Zap className={cn("h-4 w-4 transition-colors", field.value ? "text-yellow-600 fill-yellow-600/20" : "text-muted-foreground/40")} />}
                                className={cn(
                                    "p-4 transition-all duration-300", 
                                    field.value 
                                        ? "bg-yellow-500/10 border-yellow-500/30 shadow-sm ring-1 ring-yellow-500/10" 
                                        : "bg-muted/5 border-border/60 hover:border-border"
                                )}
                            />
                        )}
                    />
                </div>

                {!isDynamicPricing ? (
                    <div className="col-span-4 grid grid-cols-4 gap-4">
                        {/* Net Price */}
                        <div className="col-span-1">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="sale_price"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Precio Neto"
                                        type="number"
                                        placeholder="0"
                                        required
                                        error={fieldState.error?.message}
                                        icon={<DollarSign className="h-3.5 w-3.5 text-muted-foreground" />}
                                        className="font-black text-sm h-[1.5rem]"
                                        {...field}
                                        onChange={(e) => {
                                            field.onChange(e)
                                            handleNetChange(e.target.value)
                                        }}
                                    />
                                )}
                            />
                        </div>

                        {/* Tax (IVA) - Styled as read-only input */}
                        <div className="col-span-1">
                            <LabeledInput
                                label="Impuesto (19%)"
                                value={PricingUtils.formatCurrency(taxAmount)}
                                readOnly
                                icon={<Badge variant="outline" className="h-4 px-1 text-[8px] font-black border-blue-500/20 text-blue-600">IVA</Badge>}
                                className="font-black text-sm h-[1.5rem] bg-blue-500/5 border-blue-500/20 text-blue-600/80 cursor-default"
                            />
                        </div>

                        {/* Gross Price */}
                        <div className="col-span-1">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="sale_price_gross"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Precio Bruto"
                                        type="number"
                                        placeholder="0"
                                        error={fieldState.error?.message}
                                        icon={<DollarSign className="h-3.5 w-3.5 text-primary/60" />}
                                        className="font-black text-sm h-[1.5rem] bg-primary/5 border-primary/20"
                                        {...field}
                                        onChange={(e) => {
                                            field.onChange(e)
                                            handleGrossChange(e.target.value)
                                        }}
                                    />
                                )}
                            />
                        </div>

                        {/* Sale Unit */}
                        <div className="col-span-1">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="sale_uom"
                                render={({ field, fieldState }) => (
                                    <UoMSelector
                                        label="Unidad Venta"
                                        variant="standalone"
                                        required
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        uoms={uoms}
                                        product={{ uom: stockUomId } as any}
                                        context="sale"
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="col-span-4 p-6 border-2 border-dashed rounded-xl bg-muted/5 flex flex-col items-center justify-center text-center">
                        <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
                            <Zap className="h-5 w-5 text-yellow-600" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">Modo de Precio Abierto</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
                            El precio se solicitará al operador durante el proceso de facturación o venta.
                        </p>
                    </div>
                )}

                {/* Helper info */}
                <div className="col-span-4 flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[10px] text-blue-600/80 font-medium">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Los precios se redondean automáticamente a la unidad más cercana (CLP). El IVA se calcula sobre el valor neto ingresado.</span>
                </div>
            </div>
        </div>
    )
}
