import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface ProductPricingSectionProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
}

export function ProductPricingSection({ form, initialData }: ProductPricingSectionProps) {
    const salePrice = form.watch("sale_price") || 0
    const ivaCalculated = Math.round(Number(salePrice) * 0.19)
    const totalCalculated = Math.round(Number(salePrice) + ivaCalculated)
    const costPrice = Number(initialData?.cost_price || 0)

    const marginPercentage = salePrice > 0
        ? Math.round((1 - (costPrice / salePrice)) * 100)
        : 0

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-primary/5 border border-primary/10">
            <FormField<ProductFormValues>
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Precio Venta Neto</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <Input type="number" className="pl-7 font-bold text-lg" {...field} />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="space-y-2">
                <Label className="text-muted-foreground">IVA (19%)</Label>
                <div className="h-10 flex items-center px-3 rounded-md bg-muted/50 font-medium text-muted-foreground">
                    $ {ivaCalculated.toLocaleString()}
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-primary font-bold">Total con IVA (Bruto)</Label>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-primary/50">$</span>
                    <Input
                        type="number"
                        className="pl-7 bg-primary/10 border-primary/30 font-extrabold text-primary text-lg"
                        value={totalCalculated || ""}
                        onChange={(e) => {
                            const gross = Number(e.target.value);
                            const net = Math.round(gross / 1.19);
                            form.setValue("sale_price", net);
                        }}
                    />
                </div>
            </div>

            {(initialData || Number(salePrice) > 0) && (
                <div className="space-y-2">
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
                            <span>Costo: ${costPrice.toLocaleString()}</span>
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
