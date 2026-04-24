import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledContainer } from "@/components/shared"
import { Info } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Search, ChevronsUpDown, Check } from "lucide-react"

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
        <div className="space-y-4">
            {/* Only for Manufacturable (Simple or Advanced) */}
            {(productType === 'MANUFACTURABLE' || form.watch("requires_advanced_manufacturing")) && (
                <div className="flex items-center space-x-3 p-3 rounded-md bg-muted/5 border border-primary/10 mb-4">
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
                                    className="text-xs font-black uppercase tracking-tight cursor-pointer"
                                >
                                    Precio Gestionable (Dinámico)
                                </Label>
                            </div>
                        )}
                    />
                    <span className="text-[10px] text-muted-foreground ml-auto italic">
                        (El precio se asignará manualmente al momento de la venta)
                    </span>
                </div>
            )}

            <div className="relative p-5 pt-8 rounded-lg border-2 bg-card shadow-sm border-primary/10">
                <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Precios y Márgenes de Venta</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="sale_price"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Precio Neto"
                                type="number"
                                step="1"
                                icon="$"
                                disabled={isDynamicPricing}
                                error={fieldState.error?.message}
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => {
                                    field.onChange(e)
                                    handleNetChange(e)
                                }}
                                className={cn("font-bold text-lg h-11", isDynamicPricing && "opacity-50")}
                            />
                        )}
                    />

                    <div className={cn("flex-1", isDynamicPricing && "opacity-50")}>
                        <LabeledContainer label="Impuestos (IVA 19%)" className="w-full bg-muted/30 border-dashed">
                            <div className="h-[34px] flex items-center px-3 font-mono text-sm font-black text-muted-foreground/60">
                                + {formatCurrency(salePriceGross - salePrice)}
                            </div>
                        </LabeledContainer>
                    </div>

                    <FormField<ProductFormValues>
                        control={form.control}
                        name="sale_price_gross"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Total Bruto (Venta)"
                                type="number"
                                step="1"
                                icon="$"
                                disabled={isDynamicPricing}
                                error={fieldState.error?.message}
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => {
                                    field.onChange(e)
                                    handleGrossChange(e)
                                }}
                                className={cn("font-black text-primary text-xl h-11", isDynamicPricing && "opacity-50")}
                                containerClassName="border-primary/20"
                            />
                        )}
                    />

                    <FormField<ProductFormValues>
                        control={form.control}
                        name="sale_uom"
                        render={({ field, fieldState }) => {
                            const allowedIds = form.watch("allowed_sale_uoms") || [];
                            const allowedUoms = uoms.filter(u => allowedIds.includes(u.id.toString()));
                            const isDisabled = allowedIds.length === 0;

                            return (
                                <LabeledContainer
                                    label="Unidad de Venta"
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
                                                className={cn("w-full justify-between font-black text-xs h-[34px] px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                            >
                                                {field.value
                                                    ? allowedUoms.find((u) => u.id.toString() === field.value.toString())?.name
                                                    : (isDisabled ? "Añadir UdM" : "Predeterminada")}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <div className="p-2">
                                                <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                    <input
                                                        className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
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
                                </LabeledContainer>
                            );
                        }}
                    />
                </div>

                {(initialData || Number(salePrice) > 0) && (
                    <div className="mt-8 pt-6 border-t flex flex-col gap-4">
                        <div className={cn(
                            "flex items-center justify-between p-4 rounded-lg border shadow-inner transition-all duration-500",
                            marginPercentage > 30
                                ? "bg-success/5 border-success/20 text-success"
                                : marginPercentage > 15
                                    ? "bg-warning/5 border-warning/20 text-warning"
                                    : "bg-destructive/5 border-destructive/20 text-destructive"
                        )}>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Costo Base Calculado</span>
                                <span className="text-xl font-mono font-black">{formatCurrency(costPrice)}</span>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Margen Comercial Bruto</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-muted/30 rounded-full overflow-hidden border border-muted-foreground/10">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-1000 ease-out",
                                                marginPercentage > 30 ? "bg-success" : marginPercentage > 15 ? "bg-warning" : "bg-destructive"
                                            )}
                                            style={{ width: `${Math.min(Math.max(marginPercentage, 0), 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-lg font-black">{marginPercentage}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 p-3 bg-primary/5 rounded border border-primary/10 text-[10px] text-muted-foreground/80">
                            <Info className="h-4 w-4 text-primary shrink-0" />
                            <p>El margen se calcula comparando el <strong>Precio Neto</strong> con el <strong>Costo Base</strong> (PMP o Costo de BoM si aplica). Un margen saludable en manufactura suele superar el 30%.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
