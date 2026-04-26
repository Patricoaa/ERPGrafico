import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledContainer, FormSection } from "@/components/shared"
import { Info, DollarSign, Percent, TrendingUp } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Search, ChevronDown, Check, ShieldCheck } from "lucide-react"

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
            {/* Dynamic Pricing Banner */}
            {(productType === 'MANUFACTURABLE' || form.watch("requires_advanced_manufacturing")) && (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-sm">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <FormField
                        control={form.control}
                        name="is_dynamic_pricing"
                        render={({ field }) => (
                            <div className="flex-1 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-black uppercase tracking-tight">Precio Dinámico</p>
                                    <p className="text-[10px] text-muted-foreground">El valor se define al momento de la venta según costos actuales.</p>
                                </div>
                                <Checkbox
                                    id="is_dynamic_pricing"
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (checked) {
                                            form.setValue("sale_price", 0);
                                            form.setValue("sale_price_gross", 0);
                                        }
                                    }}
                                    className="h-5 w-5"
                                />
                            </div>
                        )}
                    />
                </div>
            )}

            {/* Main Pricing Section */}
            <div className="space-y-4">
                <FormSection title="Estrategia de Precios" icon={DollarSign} />
                <div className="grid grid-cols-4 gap-4 items-start">
                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="sale_price"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Neto Base"
                                    type="number"
                                    step="1"
                                    icon={<DollarSign className="h-3.5 w-3.5 opacity-40" />}
                                    disabled={isDynamicPricing}
                                    error={fieldState.error?.message}
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                        field.onChange(e)
                                        handleNetChange(e)
                                    }}
                                    className={cn("font-black text-base h-[1.5rem]", isDynamicPricing && "opacity-50")}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1">
                        <LabeledContainer label="Impuestos (19%)" className="w-full bg-muted/30 border-dashed opacity-60">
                            <div className="h-[34px] flex items-center px-3 font-mono text-[10px] font-black text-muted-foreground">
                                + {formatCurrency(salePriceGross - salePrice)}
                            </div>
                        </LabeledContainer>
                    </div>

                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="sale_price_gross"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Total Bruto"
                                    type="number"
                                    step="1"
                                    icon={<DollarSign className="h-3.5 w-3.5 opacity-60" />}
                                    disabled={isDynamicPricing}
                                    error={fieldState.error?.message}
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                        field.onChange(e)
                                        handleGrossChange(e)
                                    }}
                                    className={cn("font-black text-primary text-base h-[1.5rem]", isDynamicPricing && "opacity-50")}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="sale_uom"
                            render={({ field, fieldState }) => {
                                const allowedIds = form.watch("allowed_sale_uoms") || [];
                                const allowedUoms = uoms.filter(u => allowedIds.includes(u.id.toString()));
                                const isDisabled = allowedIds.length === 0;

                                return (
                                    <LabeledContainer
                                        label="Unidad Venta"
                                        error={fieldState.error?.message}
                                        disabled={isDisabled}
                                        className={cn("w-full", isDisabled && "opacity-50 cursor-not-allowed bg-muted/10")}
                                    >
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    disabled={isDisabled}
                                                    className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                >
                                                    {field.value
                                                        ? allowedUoms.find((u) => u.id.toString() === field.value.toString())?.name
                                                        : (isDisabled ? "Añadir UdM" : "Predeterminada")}
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                <div className="p-2">
                                                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        <input
                                                            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                            placeholder="Buscar..."
                                                            onChange={(e) => {
                                                                const val = e.target.value.toLowerCase()
                                                                const inputs = document.querySelectorAll('.uom-item')
                                                                inputs.forEach((el) => {
                                                                    if (el.textContent?.toLowerCase().includes(val)) {
                                                                        (el as HTMLElement).style.display = 'flex'
                                                                    } else {
                                                                        (el as HTMLElement).style.display = 'none'
                                                                    }
                                                                })
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin">
                                                        {allowedUoms.map((u) => (
                                                            <div
                                                                key={u.id}
                                                                className={cn(
                                                                    "uom-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                                                                    field.value === u.id.toString() && "bg-accent"
                                                                )}
                                                                onClick={() => {
                                                                    field.onChange(u.id.toString())
                                                                    document.body.click()
                                                                }}
                                                            >
                                                                <span>{u.name}</span>
                                                                {field.value === u.id.toString() && (
                                                                    <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </LabeledContainer>
                                );
                            }}
                        />
                    </div>
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
