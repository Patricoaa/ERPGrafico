import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Info, X, Package } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { useEffect } from "react"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProductUoMTabProps {
    form: UseFormReturn<ProductFormValues>
    uoms: any[]
    canBeSold?: boolean
    canBePurchased?: boolean
}

export function ProductUoMTab({ form, uoms, canBeSold, canBePurchased }: ProductUoMTabProps) {
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

        // Ensure stock UoM is always in allowed_sale_uoms if it makes sense (e.g. not service if stock is tracked? wait, this logic was generic)
        // Actually, let's keep previous logic: Ensure stock UoM is allowed.
        if (!filteredAllowed.includes(stockUomId.toString())) {
            filteredAllowed.push(stockUomId.toString())
        }

        // Avoid infinite loop by checking equality
        const areArraysEqual = (arr1: string[], arr2: string[]) =>
            arr1.length === arr2.length && arr1.every((val, index) => val === arr2[index]);

        if (!areArraysEqual(filteredAllowed, currentAllowed)) {
            form.setValue("allowed_sale_uoms", filteredAllowed)
        }

        // If current sale_uom is no longer allowed, reset it
        if (currentSaleUom && !filteredAllowed.includes(currentSaleUom.toString())) {
            form.setValue("sale_uom", stockUomId.toString())
        }
    }, [stockUomId, uoms, form]) // Added form to deps to fix lint warnings if strictly following, but might cause loops if not careful. The logic above has guard clauses.

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

                            {/* Category-based Purchase UoM selector */}
                            {canBePurchased && (productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'MANUFACTURABLE') && (
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="purchase_uom"
                                    render={({ field }) => {
                                        const stockUomId = form.watch("uom");
                                        const stockUom = uoms.find(u => u.id.toString() === stockUomId?.toString());
                                        const stockCategoryId = stockUom?.category;

                                        return (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    UdM de Compra por Defecto
                                                    <Badge variant="outline" className="text-[10px] font-normal py-0">Sugerida</Badge>
                                                </FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar unidad de compra" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {!stockCategoryId ? (
                                                            <SelectItem value="none" disabled>Seleccione primero UdM Base</SelectItem>
                                                        ) : (
                                                            uoms
                                                                .filter(u => u.category === stockCategoryId)
                                                                .map((u) => (
                                                                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                                ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription className="text-[10px]">
                                                    Esta unidad se seleccionará automáticamente en órdenes de compra.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {canBeSold && (productType === 'STORABLE' || productType === 'MANUFACTURABLE' || productType === 'SERVICE' || productType === 'CONSUMABLE') && (
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
                                                    {!stockCategoryId && productType !== 'SERVICE' ? (
                                                        <span className="text-[11px] text-muted-foreground italic px-2">
                                                            Seleccione primero una Unidad de Medida de Stock.
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {sortedUoms
                                                                .filter(u => productType === 'SERVICE' ? true : u.category === stockCategoryId) // If service, maybe allow all? Or strictly none? Usually service uses units too (Hours, Days). Assuming services also pick a UoM logic.
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
