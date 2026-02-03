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

    // Hide pricing section if product has variants enabled (prices are set per variant)
    // UNLESS forceEdit is true (for simplified variant editing)
    if (hasVariants && !forceEdit) {
        return (
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200">
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
        <div className="p-4 rounded-2xl bg-secondary/30 border border-secondary/50 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-primary rounded-full" />
                Configuración Comercial y Precios
            </h3>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField<ProductFormValues>
                    control={form.control}
                    name="sale_price"
                    render={({ field }) => (
                        <FormItem className={cn("space-y-0.5 p-3 rounded-xl border bg-background", isDynamicPricing && "opacity-50 pointer-events-none")}>
                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Precio Neto</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">$</span>
                                    <Input
                                        type="number"
                                        step="1"
                                        className={cn(FORM_STYLES.input, "pl-8 h-10 bg-transparent border-none shadow-none rounded-xl font-black text-xl transition-all focus-visible:ring-primary")}
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

                <div className={cn("space-y-0.5 p-3 rounded-xl border bg-background", isDynamicPricing && "opacity-50")}>
                    <div className="h-10 flex items-center px-3 rounded-xl bg-background/50 border font-mono text-lg font-bold text-muted-foreground">
                        {formatCurrency(salePriceGross - salePrice)}
                    </div>
                </div>
                <FormField<ProductFormValues>
                    control={form.control}
                    name="sale_price_gross"
                    render={({ field }) => (
                        <FormItem className={cn("space-y-0.5 p-3 rounded-xl border bg-primary/10", isDynamicPricing && "opacity-50 pointer-events-none")}>
                            <FormLabel className="text-[10px] font-bold uppercase text-primary">Total Bruto</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 font-bold text-lg">$</span>
                                    <Input
                                        type="number"
                                        step="1"
                                        className="pl-8 h-10 bg-transparent border-none shadow-none rounded-xl font-black text-xl text-primary transition-all focus-visible:ring-primary"
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
                            <FormItem className="space-y-0.5 p-3 rounded-xl border bg-background">
                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Unidad de Venta</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    disabled={isDisabled}
                                >
                                    <FormControl>
                                        <SelectTrigger className="bg-background border-none shadow-sm h-10 rounded-xl font-medium text-xs">
                                            <SelectValue placeholder={isDisabled ? "Añadir UdM primero" : "Predeterminada"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allowedUoms.map((u) => (
                                            <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />

                {(initialData || Number(salePrice) > 0) && (
                    <div className="md:col-span-2 flex flex-col justify-end">
                        <div className={cn(
                            "h-full flex flex-col justify-center p-4 rounded-xl border text-sm font-bold shadow-sm transition-all animate-in fade-in zoom-in duration-300",
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
