import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"
import { Info } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/EmptyState"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Search, ChevronsUpDown, Check } from "lucide-react"

import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"

import { Checkbox } from "@/components/ui/checkbox"

interface ProductPricingSectionProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
    canBeSold?: boolean
    uoms: any[]
    forceEdit?: boolean
}

export function ProductPricingSection({ form, initialData, canBeSold, uoms, forceEdit = false }: ProductPricingSectionProps) {
    const salePrice = Number(form.watch("sale_price")) || 0
    const salePriceGross = Number(form.watch("sale_price_gross")) || 0
    const productType = form.watch("product_type")
    const isDynamicPricing = form.watch("is_dynamic_pricing")
    const hasVariants = form.watch("has_variants")

    // Choice cost: BoM cost for manufacturable products (if available), otherwise weighed average cost
    const costPrice = (productType === 'MANUFACTURABLE' && initialData?.bom_cost > 0)
        ? Number(initialData.bom_cost)
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
            <div className="p-6 rounded-lg bg-amber-50/50 border border-amber-200">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                        <p className="font-medium text-amber-900">Producto con Variantes</p>
                        <p className="text-sm text-amber-700 mt-1">
                            Los precios se asignan individualmente a cada variante desde la pestaña "Variantes".
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
        <div className="space-y-4">
            <div className="flex items-center gap-2 pt-6 pb-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Precios y Costos Base</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {/* Only for Manufacturable (Simple or Advanced) */}
            {(productType === 'MANUFACTURABLE' || form.watch("requires_advanced_manufacturing")) && (
                <div className="flex items-center space-x-2 border-b border-primary/10 pb-4 mb-2">
                    <FormField
                        control={form.control}
                        name="is_dynamic_pricing"
                        render={({ field }) => (
                            <div className="flex items-center space-x-2">
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
                                />
                                <Label
                                    htmlFor="is_dynamic_pricing"
                                    className="text-xs font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    Precio Gestionable (Dinámico)
                                </Label>
                            </div>
                        )}
                    />
                    <span className="text-[10px] text-muted-foreground ml-2 italic">
                        (El precio se asignará manualmente al momento de la venta)
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <FormField<ProductFormValues>
                    control={form.control}
                    name="sale_price"
                    render={({ field }) => (
                        <FormItem className={cn(isDynamicPricing && "opacity-50 pointer-events-none")}>
                            <FormLabel className={FORM_STYLES.label}>Precio Neto</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground font-medium text-sm">$</span>
                                    <Input
                                        type="number"
                                        step="1"
                                        className={cn(FORM_STYLES.input, "pl-7 font-semibold h-10")}
                                        {...field}
                                        onChange={handleNetChange}
                                        disabled={isDynamicPricing}
                                    />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className={cn("space-y-2", isDynamicPricing && "opacity-50")}>
                    <Label className={FORM_STYLES.label}>Impuestos (IVA)</Label>
                    <div className="h-10 flex items-center px-4 rounded-lg bg-muted/20 border border-dashed font-mono text-sm font-medium text-muted-foreground">
                        + {formatCurrency(salePriceGross - salePrice)}
                    </div>
                </div>
                <FormField<ProductFormValues>
                    control={form.control}
                    name="sale_price_gross"
                    render={({ field }) => (
                        <FormItem className={cn(isDynamicPricing && "opacity-50 pointer-events-none")}>
                            <FormLabel className={cn(FORM_STYLES.label, "text-primary")}>Total Bruto</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <span className="absolute left-3 top-2.5 text-primary/50 font-medium text-sm">$</span>
                                    <Input
                                        type="number"
                                        step="1"
                                        className={cn(FORM_STYLES.input, "pl-7 font-bold text-primary border-primary/30 h-10")}
                                        {...field}
                                        onChange={handleGrossChange}
                                        disabled={isDynamicPricing}
                                    />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Relocated Sale UoM Field for better proximity to pricing */}
                <FormField<ProductFormValues>
                    control={form.control}
                    name="sale_uom"
                    render={({ field }) => {
                        const allowedIds = form.watch("allowed_sale_uoms") || [];
                        const allowedUoms = uoms.filter(u => allowedIds.includes(u.id.toString()));
                        const isDisabled = allowedIds.length === 0;

                        return (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Unidad de Venta</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                disabled={isDisabled}
                                                className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground", FORM_STYLES.input, "bg-background border-none shadow-sm h-10 rounded-lg font-medium text-xs")}
                                            >
                                                {field.value
                                                    ? allowedUoms.find((u) => u.id.toString() === field.value.toString())?.name
                                                    : (isDisabled ? "Añadir UdM primero" : "Predeterminada")}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                        <div className="p-2">
                                            <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input
                                                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                    placeholder="Buscar UdM..."
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
                                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                {allowedUoms.map((u) => (
                                                    <div
                                                        key={u.id}
                                                        className={cn(
                                                            "uom-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
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
                                                {allowedUoms.length === 0 && (
                                                    <EmptyState context="generic" variant="minimal" description="No hay opciones" />
                                                )}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />

                {(initialData || Number(salePrice) > 0) && (
                    <div className="md:col-span-4 flex flex-col pt-4">
                        <div className={cn(
                            "h-full flex flex-col justify-center p-4 rounded-lg border text-sm font-bold shadow-sm transition-all animate-in fade-in zoom-in duration-300",
                            marginPercentage > 30
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : marginPercentage > 15
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        )}>
                            <div className="flex items-center gap-2 mb-1">
                                <Info className="h-4 w-4 opacity-70" />
                                <span className="text-[10px] uppercase tracking-wider opacity-70">Costo Base:</span>
                                <span className="text-base">{formatCurrency(costPrice)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider opacity-70">Margen de Ganancia:</span>
                                <Badge className={cn(
                                    "px-2 py-0.5 rounded-lg text-sm font-black border-none shadow-none uppercase tracking-tighter",
                                    marginPercentage > 30
                                        ? "bg-emerald-500 text-white"
                                        : marginPercentage > 15
                                            ? "bg-amber-500 text-white"
                                            : "bg-rose-500 text-white"
                                )}>
                                    {marginPercentage}%
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
