import { useMemo } from "react"
import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledContainer, FormSection, LabeledCheckbox, LabeledSwitch } from "@/components/shared"
import { Info, DollarSign, Percent, TrendingUp } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Search, ChevronDown, Check, ShieldCheck, Trash2 } from "lucide-react"
import { UoMSelector } from "@/components/selectors"

import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from '@/features/inventory/utils/pricing'

import { Checkbox } from "@/components/ui/checkbox"
import { Product, UoM } from "@/types/entities"
import { ProductInitialData } from "@/types/forms"

interface ProductPricingSectionProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: (ProductInitialData | Partial<Product>) & { bom_cost?: number, cost_price?: number }
    canBeSold?: boolean
    uoms: UoM[]
    forceEdit?: boolean
}

export function ProductPricingSection({ form, initialData, canBeSold, uoms, forceEdit = false }: ProductPricingSectionProps) {
    const salePrice = Number(form.watch("sale_price")) || 0
    const salePriceGross = Number(form.watch("sale_price_gross")) || 0
    const productType = form.watch("product_type")
    const isDynamicPricing = form.watch("is_dynamic_pricing")
    const hasVariants = form.watch("has_variants")
    const watchedUom = form.watch("uom")
    const allowedSaleUoms = form.watch("allowed_sale_uoms") || []
    const requiresAdvancedMfg = form.watch("requires_advanced_manufacturing")

    // Stable product object for UoMSelector — prevents infinite re-render loop
    // caused by passing a new object literal reference on every render.
    const saleUomProduct = useMemo(
        () => ({ uom: watchedUom, allowed_sale_uoms: allowedSaleUoms } as any),
        // allowedSaleUoms is always a new array ref from form.watch, so JSON.stringify for stable comparison
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [watchedUom, JSON.stringify(allowedSaleUoms)]
    )

    // Choice cost: BoM cost for manufacturable products (if available), otherwise weighed average cost
    const costPrice = (productType === 'MANUFACTURABLE' && (initialData?.bom_cost ?? 0) > 0)
        ? Number(initialData?.bom_cost)
        : Number(initialData?.cost_price || 0)

    const marginPercentage = PricingUtils.calculateMargin(salePrice, costPrice)

    // Hide pricing section if product cannot be sold
    if (!canBeSold) return null;

    // Hide pricing section if product is a subscription (uses the Commercial tab instead)
    if (productType === 'SUBSCRIPTION') return null;

    // Hide pricing section if product has variants enabled (prices are set per variant)
    // UNLESS forceEdit is true (for simplified variant editing)
    if (hasVariants && !forceEdit) {
        return (
            <div className="p-6 rounded-md bg-warning/10/50 border border-warning/20">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-warning mt-0.5" />
                    <div>
                        <p className="font-medium text-warning">Producto con Variantes</p>
                        <p className="text-sm text-warning mt-1">
                            Los precios se asignan individualmente a cada variante desde la pestaña &quot;Variantes&quot;.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Handlers for synchronization
    const handleNetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const net = Number(e.target.value) || 0
        const gross = PricingUtils.netToGross(net)
        form.setValue("sale_price", net)
        form.setValue("sale_price_gross", gross)
    }

    const handleGrossChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const gross = Number(e.target.value) || 0
        const net = PricingUtils.grossToNet(gross)
        form.setValue("sale_price_gross", gross)
        form.setValue("sale_price", net)
    }
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Pricing Strategy Section - 4-Column Layout */}
            <div className="space-y-4">
                <FormSection title="Estrategia de Precios" icon={DollarSign} />
                {/* Dynamic Pricing Banner */}
                {(productType === 'MANUFACTURABLE' || requiresAdvancedMfg) && (
                    <FormField
                        control={form.control}
                        name="is_dynamic_pricing"
                        render={({ field }) => (
                            <LabeledSwitch
                                label="Precio Dinámico"
                                description="El valor se define al momento de la venta según costos actuales."
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (checked) {
                                        form.setValue("sale_price", 0);
                                        form.setValue("sale_price_gross", 0);
                                    }
                                }}
                                icon={<TrendingUp className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
                                className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
                            />
                        )}
                    />
                )}


                <div className="grid grid-cols-4 gap-4 items-start">
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="sale_price"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Neto Base"
                                required
                                type="number"
                                placeholder="0.00"
                                error={fieldState.error?.message}
                                disabled={isDynamicPricing}
                                className="font-bold text-xs h-[1.5rem]"
                                icon={<DollarSign className="h-3.5 w-3.5 opacity-40" />}
                                {...field}
                                value={field.value ?? ""}
                                onChange={handleNetChange}
                            />
                        )}
                    />

                    <LabeledContainer
                        label="Impuestos (19%)"
                        className="bg-muted/5"
                    >
                        <div className="flex items-center gap-2 h-full px-3 min-h-[1.5rem]">
                            <span className="text-muted-foreground/50 font-medium text-xs">+</span>
                            <span className="font-bold text-sm text-primary/60">
                                {formatCurrency(salePriceGross - salePrice)}
                            </span>
                        </div>
                    </LabeledContainer>

                    <FormField<ProductFormValues>
                        control={form.control}
                        name="sale_price_gross"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Total Bruto"
                                type="number"
                                placeholder="0.00"
                                error={fieldState.error?.message}
                                disabled={isDynamicPricing}
                                className="font-bold text-xs text-primary h-[1.5rem]"
                                icon={<DollarSign className="h-3.5 w-3.5 text-primary/40" />}
                                {...field}
                                value={field.value ?? ""}
                                onChange={handleGrossChange}
                            />
                        )}
                    />

                    <FormField<ProductFormValues>
                        control={form.control}
                        name="sale_uom"
                        render={({ field, fieldState }) => {
                            const isDisabled = allowedSaleUoms.length === 0;

                            return (
                                <UoMSelector
                                    label="Unidad Venta"
                                    variant="standalone"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    uoms={uoms}
                                    product={saleUomProduct}
                                    context="sale"
                                    error={fieldState.error?.message}
                                    disabled={isDisabled}
                                />
                            );
                        }}
                    />
                </div>

                {/* Margin Analytics Panel */}
                {(initialData || Number(salePrice) > 0) && (
                    <div className="mt-6 p-1 rounded-2xl bg-muted/30 border shadow-inner">
                        <div className={cn(
                            "flex items-center justify-between p-5 rounded-xl border shadow-sm transition-all duration-700",
                            marginPercentage > 30
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                                : marginPercentage > 15
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                                    : "bg-destructive/10 border-destructive/20 text-destructive"
                        )}>
                            <div className="flex flex-col">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> Costo Base PMP
                                </p>
                                <p className="text-2xl font-mono font-black">{formatCurrency(costPrice)}</p>
                            </div>

                            <div className="flex flex-col items-end">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Rentabilidad Estimada</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-48 h-3 bg-background/50 rounded-full overflow-hidden border p-0.5">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000 ease-out",
                                                marginPercentage > 30 ? "bg-emerald-500" : marginPercentage > 15 ? "bg-amber-500" : "bg-destructive"
                                            )}
                                            style={{ width: `${Math.min(Math.max(marginPercentage, 0), 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-2xl font-black">{marginPercentage}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ProductPricingSection
