import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
                            {/* Stock UoM: Only for Storable and Consumable */}
                            {(productType === 'STORABLE' || productType === 'CONSUMABLE') && (
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

                            {/* Sale UoM: Storable, Service, Manufacturable */}
                            {(productType === 'STORABLE' || productType === 'MANUFACTURABLE' || productType === 'SERVICE') && (
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="sale_uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Unidad de Medida de Venta por Defecto</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Requerido para ventas" />
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
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {(productType === 'STORABLE' || productType === 'MANUFACTURABLE' || productType === 'SERVICE') && (
                        <div className="p-6 rounded-2xl border bg-card/50">
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                Unidades de Venta Permitidas
                            </h3>
                            <p className="text-[11px] text-muted-foreground mb-4">
                                Define explícitamente qué unidades estarán disponibles al vender.
                                Una vez seleccionada la primera, las demás deben ser de la misma categoría.
                            </p>

                            <FormField<ProductFormValues>
                                control={form.control}
                                name="allowed_sale_uoms"
                                render={({ field }) => {
                                    const selectedIds = field.value || [];
                                    const saleUomId = form.watch("sale_uom");
                                    const saleUom = uoms.find(u => u.id.toString() === saleUomId);
                                    const categoryId = saleUom?.category;
                                    const isDisabled = !saleUomId;

                                    const sortedUoms = [...uoms].sort((a, b) => {
                                        const catCompare = (a.category_name || "").localeCompare(b.category_name || "");
                                        if (catCompare !== 0) return catCompare;
                                        return a.name.localeCompare(b.name);
                                    });

                                    return (
                                        <FormItem>
                                            <div className={cn("space-y-3", isDisabled && "opacity-50 pointer-events-none")}>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {selectedIds.map((id: string) => {
                                                        const uom = uoms.find((u: any) => u.id.toString() === id);
                                                        return (
                                                            <Badge key={id} variant="secondary" className="pl-3 pr-1 py-1 gap-2 rounded-lg">
                                                                {uom?.name}
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 rounded-full hover:bg-destructive hover:text-white"
                                                                    onClick={() => field.onChange(selectedIds.filter((i: string) => i !== id))}
                                                                >
                                                                    <X className="h-2 w-2" />
                                                                </Button>
                                                            </Badge>
                                                        );
                                                    })}
                                                    {selectedIds.length === 0 && (
                                                        <span className="text-[10px] text-muted-foreground italic">
                                                            {isDisabled ? "Seleccione unidad por defecto primero." : "Ninguna seleccionada. Se usará la unidad por defecto."}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto max-h-[300px] p-1 border rounded-xl bg-muted/20">
                                                    {sortedUoms.map((u: any) => {
                                                        const isSelected = selectedIds.includes(u.id.toString());
                                                        const isDifferentCategory = categoryId !== undefined && u.category !== categoryId;
                                                        const itemDisabled = isDisabled || isDifferentCategory;

                                                        return (
                                                            <div
                                                                key={u.id}
                                                                className={cn(
                                                                    "flex items-center space-x-2 p-2 rounded-lg border transition-all cursor-pointer",
                                                                    isSelected ? "bg-primary/10 border-primary/30" : "bg-background border-transparent hover:border-muted-foreground/30",
                                                                    itemDisabled && "opacity-30 cursor-not-allowed grayscale pointer-events-none"
                                                                )}
                                                                onClick={() => {
                                                                    if (itemDisabled) return;
                                                                    if (isSelected) {
                                                                        field.onChange(selectedIds.filter((id: string) => id !== u.id.toString()));
                                                                    } else {
                                                                        field.onChange([...selectedIds, u.id.toString()]);
                                                                    }
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    disabled={itemDisabled}
                                                                    className="rounded"
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-medium leading-tight">{u.name}</span>
                                                                    <span className="text-[9px] text-muted-foreground leading-tight">{u.category_name}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {saleUom && (
                                                    <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                                                        <Info className="h-3 w-3" />
                                                        Filtrado por categoría: {saleUom.category_name}
                                                    </p>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </TabsContent>
    )
}
