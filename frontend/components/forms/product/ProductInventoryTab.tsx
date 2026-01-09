import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Info, X, Package } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    uoms: any[]
}

export function ProductInventoryTab({ form, uoms }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")

    const sortedUoms = [...uoms].sort((a, b) => {
        const catCompare = (a.category_name || "").localeCompare(b.category_name || "");
        if (catCompare !== 0) return catCompare;
        return a.name.localeCompare(b.name);
    });

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
                                    <FormItem className="flex items-center justify-between p-4 rounded-xl border bg-background/50">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-xs font-bold">Controlar Inventario</FormLabel>
                                            <FormDescription className="text-[10px]">
                                                Habilitar para productos que se almacenan físicamente.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {(productType === 'STORABLE' || productType === 'MANUFACTURABLE' || productType === 'SERVICE') && (
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
                                        const selectedIds = field.value || [];
                                        const firstSelectedId = selectedIds[0];
                                        const firstSelectedUom = uoms.find(u => u.id.toString() === firstSelectedId);
                                        const categoryId = firstSelectedUom?.category;

                                        return (
                                            <FormItem className="space-y-4">
                                                <div className="flex flex-wrap gap-2 p-4 rounded-xl border bg-muted/10 min-h-[60px] items-center">
                                                    {sortedUoms.map((u: any) => {
                                                        const isSelected = selectedIds.includes(u.id.toString());
                                                        const isDifferentCategory = categoryId !== undefined && u.category !== categoryId;

                                                        if (isDifferentCategory && !isSelected) return null;

                                                        return (
                                                            <Badge
                                                                key={u.id}
                                                                variant={isSelected ? "default" : "outline"}
                                                                className={cn(
                                                                    "cursor-pointer px-3 py-1.5 transition-all hover:scale-105 active:scale-95 border-primary/20",
                                                                    isSelected ? "bg-primary text-white shadow-md" : "bg-background hover:bg-muted font-normal text-muted-foreground",
                                                                    isDifferentCategory && "opacity-50 grayscale pointer-events-none"
                                                                )}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        const newList = selectedIds.filter((id: string) => id !== u.id.toString());
                                                                        field.onChange(newList);
                                                                        // If we deselect the default sale unit, update it
                                                                        if (form.getValues("sale_uom") === u.id.toString()) {
                                                                            form.setValue("sale_uom", newList[0] || "");
                                                                        }
                                                                    } else {
                                                                        const newList = [...selectedIds, u.id.toString()];
                                                                        field.onChange(newList);
                                                                        // Auto-set as default if it's the first one
                                                                        if (!form.getValues("sale_uom")) {
                                                                            form.setValue("sale_uom", u.id.toString());
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {u.name}
                                                                {isSelected && <X className="ml-2 h-3 w-3 inline-block" />}
                                                            </Badge>
                                                        );
                                                    })}
                                                    {selectedIds.length === 0 && (
                                                        <span className="text-[11px] text-muted-foreground italic px-2">
                                                            Añade unidades para habilitar la venta.
                                                        </span>
                                                    )}
                                                </div>

                                                {firstSelectedUom && (
                                                    <p className="text-[10px] text-primary/70 font-medium flex items-center gap-1.5 px-1 uppercase tracking-wider">
                                                        <Info className="h-3 w-3" />
                                                        Categoría: {firstSelectedUom.category_name}
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </div>

                            {/* 2. Default Sale Unit (Selection from Allowed) */}
                            <div className="pt-6 border-t">
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="sale_uom"
                                    render={({ field }) => {
                                        const allowedIds = form.watch("allowed_sale_uoms") || [];
                                        const allowedUoms = uoms.filter(u => allowedIds.includes(u.id.toString()));
                                        const isDisabled = allowedIds.length === 0;

                                        return (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Venta por Defecto</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={isDisabled}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="mt-2 bg-background border-primary/20">
                                                            <SelectValue placeholder={isDisabled ? "Primero añade unidades arriba" : "Selecciona la predeterminada"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {allowedUoms.map((u) => (
                                                            <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription className="text-[10px]">
                                                    Unidad pre-seleccionada en ventas y POS.
                                                </FormDescription>
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
