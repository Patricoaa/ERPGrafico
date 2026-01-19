import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
}

export function ProductPricingSection({ form, initialData, canBeSold, uoms }: ProductPricingSectionProps) {
    const salePrice = form.watch("sale_price") || 0
    const productType = form.watch("product_type")
    const isDynamicPricing = form.watch("is_dynamic_pricing")
    const ivaCalculated = PricingUtils.calculateTax(Number(salePrice))
    const totalCalculated = PricingUtils.netToGross(Number(salePrice))

    // Choose cost: BoM cost for manufacturable products (if available), otherwise weighed average cost
    const costPrice = (productType === 'MANUFACTURABLE' && initialData?.bom_cost > 0)
        ? Number(initialData.bom_cost)
        : Number(initialData?.cost_price || 0)

    const marginPercentage = PricingUtils.calculateMargin(salePrice, costPrice)

    if (!canBeSold) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-primary/5 border border-primary/10">
            <div className="md:col-span-4 flex items-center space-x-2 border-b border-primary/10 pb-4 mb-2">
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
                                    }
                                }}
                            />
                            <Label
                                htmlFor="is_dynamic_pricing"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Precio Gestionable (Dinámico)
                            </Label>
                        </div>
                    )}
                />
                <span className="text-xs text-muted-foreground ml-2">
                    (El precio se asignará manualmente al momento de la venta)
                </span>
            </div>

            <FormField<ProductFormValues>
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                    <FormItem className={isDynamicPricing ? "opacity-50 pointer-events-none" : ""}>
                        <FormLabel>Precio Venta Neto</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <Input type="number" step="1" className="pl-7 font-bold text-lg" {...field} disabled={isDynamicPricing} />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className={cn("space-y-2", isDynamicPricing && "opacity-50")}>
                <Label className="text-muted-foreground">IVA (19%)</Label>
                <div className="h-10 flex items-center px-3 rounded-md bg-muted/50 font-medium text-muted-foreground">
                    {formatCurrency(ivaCalculated)}
                </div>
            </div>

            <div className={cn("space-y-2", isDynamicPricing && "opacity-50 pointer-events-none")}>
                <Label className="text-primary font-bold">Total con IVA (Bruto)</Label>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-primary/50">$</span>
                    <Input
                        type="number"
                        step="1"
                        className="pl-7 bg-primary/10 border-primary/30 font-extrabold text-primary text-lg"
                        value={totalCalculated || ""}
                        disabled={isDynamicPricing}
                        onChange={(e) => {
                            const gross = Number(e.target.value);
                            const net = PricingUtils.grossToNet(gross);
                            form.setValue("sale_price", net);
                        }}
                    />
                </div>
            </div>

            {/* Relocated Sale UoM Field */}
            <FormField<ProductFormValues>
                control={form.control}
                name="sale_uom"
                render={({ field }) => {
                    const allowedIds = form.watch("allowed_sale_uoms") || [];
                    const allowedUoms = uoms.filter(u => allowedIds.includes(u.id.toString()));
                    const isDisabled = allowedIds.length === 0;

                    return (
                        <FormItem>
                            <FormLabel className="text-primary font-bold">Unidad de Venta</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={isDisabled}
                            >
                                <FormControl>
                                    <SelectTrigger className="bg-primary/5 border-primary/20 h-10">
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
                <div className="md:col-span-4 space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Análisis de Margen</Label>
                    <div className={cn(
                        "h-10 flex items-center justify-between px-4 rounded-xl border text-sm font-bold shadow-sm transition-all animate-in fade-in zoom-in duration-300",
                        marginPercentage > 30
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : marginPercentage > 15
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                    )}>
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 opacity-70" />
                            <span>Costo: {formatCurrency(costPrice)}</span>
                        </div>
                        <Badge className={cn(
                            "px-2 py-0.5 rounded-lg text-[11px] font-black border-none shadow-none uppercase tracking-tighter",
                            marginPercentage > 30
                                ? "bg-emerald-500 text-white"
                                : marginPercentage > 15
                                    ? "bg-amber-500 text-white"
                                    : "bg-rose-500 text-white"
                        )}>
                            {marginPercentage}% MARGEN
                        </Badge>
                    </div>
                </div>
            )}
        </div>
    )
}
