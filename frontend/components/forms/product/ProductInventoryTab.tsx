import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Info, X, Package } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { useEffect } from "react"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    uoms: any[]
    canBeSold?: boolean
    initialData?: any
}

export function ProductInventoryTab({ form, uoms, canBeSold, initialData }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")

    const sortedUoms = [...uoms].sort((a, b) => {
        const catCompare = (a.category_name || "").localeCompare(b.category_name || "");
        if (catCompare !== 0) return catCompare;
        return a.name.localeCompare(b.name);
    });

    // Auto-sync category and clear incompatible sale UoMs
    const stockUomId = form.watch("uom")
    useEffect(() => {
        if (!stockUomId) return

        const stockUom = uoms.find(u => u.id.toString() === stockUomId.toString())
        if (!stockUom) return

        const currentAllowed = form.getValues("allowed_sale_uoms") || []
        const currentSaleUom = form.getValues("sale_uom")

        // Filter out UoMs that are not in the same category
        const filteredAllowed = currentAllowed.filter(id => {
            const u = uoms.find(uom => uom.id.toString() === id.toString())
            return u?.category === stockUom.category
        })

        // Ensure stock UoM is always in allowed_sale_uoms
        if (!filteredAllowed.includes(stockUomId.toString())) {
            filteredAllowed.push(stockUomId.toString())
        }

        if (filteredAllowed.length !== currentAllowed.length) {
            form.setValue("allowed_sale_uoms", filteredAllowed)
        }

        // If current sale_uom is no longer allowed, reset it
        if (currentSaleUom && !filteredAllowed.includes(currentSaleUom.toString())) {
            form.setValue("sale_uom", stockUomId.toString())
        }
    }, [stockUomId, uoms])

    return (
        <TabsContent value="uoms" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl border bg-card/50">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                            <Package className="h-4 w-4" />
                            Unidades de Medida Básicas
                        </h3>

                        <div className="space-y-4">
                            {/* Stock UoM: Storable, Consumable and Manufacturable */}
                            {(productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'MANUFACTURABLE') && (
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Unidad de Medida de Stock (Interna)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar unidad base" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {uoms.map((u) => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField<ProductFormValues>
                                control={form.control}
                                name="track_inventory"
                                render={({ field }) => (
                                    <div className="space-y-4">
                                        <FormItem className="flex items-center justify-between p-4 rounded-xl border bg-background/50">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs font-bold">Controlar Inventario</FormLabel>
                                                <FormDescription className="text-[10px]">
                                                    Habilitar para productos que necesitan un control de inventario estricto.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>

                                        {field.value && initialData && (
                                            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/20 rounded-lg border border-dashed">
                                                <div className="flex flex-col items-center bg-background rounded p-2 shadow-sm">
                                                    <span className="text-[10px] uppercase text-muted-foreground font-bold">A Mano</span>
                                                    <span className="text-lg font-bold tabular-nums">{initialData.current_stock || 0}</span>
                                                </div>
                                                <div className="flex flex-col items-center bg-amber-50 rounded p-2 shadow-sm border border-amber-100">
                                                    <span className="text-[10px] uppercase text-amber-700 font-bold">Reservado</span>
                                                    <span className="text-lg font-bold tabular-nums text-amber-700">{initialData.qty_reserved || 0}</span>
                                                </div>
                                                <div className="flex flex-col items-center bg-emerald-50 rounded p-2 shadow-sm border border-emerald-100">
                                                    <span className="text-[10px] uppercase text-emerald-700 font-bold">Disponible</span>
                                                    <span className="text-lg font-bold tabular-nums text-emerald-700">{initialData.qty_available || 0}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {canBeSold && (productType === 'STORABLE' || productType === 'MANUFACTURABLE' || productType === 'SERVICE') && (
                        <div className="p-6 rounded-2xl border bg-card/50 space-y-8">
                            {/* 1. Permitted Units Selection */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    Unidades de Venta Permitidas
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                    Selecciona las unidades que estarán disponibles en ventas.
                                    La primera define la categoría.
                                </p>

                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="allowed_sale_uoms"
                                    render={({ field }) => {
                                        const stockUomId = form.watch("uom");
                                        const stockUom = uoms.find(u => u.id.toString() === stockUomId?.toString());
                                        const stockCategoryId = stockUom?.category;

                                        const selectedIds = field.value || [];

                                        return (
                                            <FormItem className="space-y-4">
                                                <div className="flex flex-wrap gap-2 p-4 rounded-xl border bg-muted/10 min-h-[60px] items-center">
                                                    {!stockCategoryId ? (
                                                        <span className="text-[11px] text-muted-foreground italic px-2">
                                                            Seleccione primero una Unidad de Medida de Stock.
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {sortedUoms
                                                                .filter(u => u.category === stockCategoryId)
                                                                .map((u: any) => {
                                                                    const isSelected = selectedIds.includes(u.id.toString());
                                                                    const isBaseUom = u.id.toString() === stockUomId?.toString();

                                                                    return (
                                                                        <Badge
                                                                            key={u.id}
                                                                            variant={isSelected ? "default" : "outline"}
                                                                            className={cn(
                                                                                "cursor-pointer px-3 py-1.5 transition-all hover:scale-105 active:scale-95 border-primary/20",
                                                                                isSelected ? "bg-primary text-white shadow-md font-bold" : "bg-background hover:bg-muted font-normal text-muted-foreground",
                                                                                isBaseUom && "ring-2 ring-primary ring-offset-1"
                                                                            )}
                                                                            onClick={() => {
                                                                                if (isSelected) {
                                                                                    const newList = selectedIds.filter((id: string) => id !== u.id.toString());
                                                                                    field.onChange(newList);
                                                                                } else {
                                                                                    const newList = [...selectedIds, u.id.toString()];
                                                                                    field.onChange(newList);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {u.name}
                                                                            {isBaseUom && <span className="ml-1.5 text-[8px] opacity-70">(BASE)</span>}
                                                                            {isSelected && !isBaseUom && <X className="ml-2 h-3 w-3 inline-block" />}
                                                                        </Badge>
                                                                    );
                                                                })
                                                            }
                                                            {sortedUoms.filter(u => u.category === stockCategoryId).length === 0 && (
                                                                <span className="text-[11px] text-muted-foreground italic px-2">
                                                                    No hay otras unidades en esta categoría.
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {stockUom && (
                                                    <p className="text-[10px] text-primary/70 font-medium flex items-center gap-1.5 px-1 uppercase tracking-wider">
                                                        <Info className="h-3 w-3" />
                                                        Categoría: {stockUom.category_name}
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </TabsContent>
    )
}
