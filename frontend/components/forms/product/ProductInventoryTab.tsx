import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Package, Settings2, Plus, Warehouse } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
    warehouses?: any[]
    uoms?: any[]
}

export function ProductInventoryTab({ form, initialData, warehouses = [], uoms = [] }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")
    const trackInventory = form.watch("track_inventory")

    // Determine if switch is disabled based on requirements
    const isSwitchDisabled = productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'SERVICE'

    return (
        <TabsContent value="logistics" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* Units of Measure Section */}
                    <div className="p-6 rounded-2xl border bg-card/50 space-y-6">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                            <Settings2 className="h-4 w-4" />
                            Unidades de Medida
                        </h3>

                        <div className="grid grid-cols-1 gap-4">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="uom"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                            <FormLabel className={FORM_STYLES.label}>Unidad de Stock (Base)</FormLabel>
                                        </div>
                                        <FormControl>
                                            <select
                                                className={cn(FORM_STYLES.input, "flex w-full px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring")}
                                                {...field}
                                            >
                                                <option value="">Seleccionar unidad...</option>
                                                {uoms.map((u) => (
                                                    <option key={u.id} value={u.id.toString()}>{u.name}</option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField<ProductFormValues>
                                control={form.control}
                                name="purchase_uom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Unidad de Compra</FormLabel>
                                        <FormControl>
                                            <select
                                                className={cn(FORM_STYLES.input, "flex w-full px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring")}
                                                {...field}
                                            >
                                                <option value="">Igual a Stock</option>
                                                {uoms.map((u) => (
                                                    <option key={u.id} value={u.id.toString()}>{u.name}</option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Sale UoM Selection UI */}
                            {form.watch("can_be_sold") && (
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="allowed_sale_uoms"
                                    render={({ field }) => {
                                        const stockUomId = form.watch("uom");
                                        const stockUom = uoms.find(u => u.id.toString() === stockUomId?.toString());
                                        const stockCategoryId = stockUom?.category;

                                        const selectedIds = field.value || [];
                                        const sortedUoms = [...uoms].sort((a, b) => a.name.localeCompare(b.name));

                                        return (
                                            <FormItem className="space-y-3 pt-4 border-t mt-2">
                                                <div className="flex items-center justify-between">
                                                    <FormLabel className={FORM_STYLES.label}>Unidades de Venta Permitidas</FormLabel>
                                                    {stockUom && (
                                                        <span className="text-[10px] text-primary/70 font-bold uppercase tracking-tighter">
                                                            Cat: {stockUom.category_name || "Desconocida"}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 p-3 rounded-xl border bg-muted/5 min-h-[50px] items-center">
                                                    {!stockCategoryId ? (
                                                        <span className="text-[10px] text-muted-foreground italic px-1">
                                                            Seleccione primero una Unidad de Stock.
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
                                                                                "cursor-pointer px-2 py-1 transition-all hover:scale-105 active:scale-95 border-primary/20 text-[10px]",
                                                                                isSelected ? "bg-primary text-white shadow-sm font-bold" : "bg-background hover:bg-muted font-normal text-muted-foreground",
                                                                                isBaseUom && "ring-1 ring-primary ring-offset-1"
                                                                            )}
                                                                            onClick={() => {
                                                                                if (isSelected) {
                                                                                    // Don't deselect base UoM
                                                                                    if (isBaseUom) return;
                                                                                    const newList = selectedIds.filter((id: string) => id !== u.id.toString());
                                                                                    field.onChange(newList);
                                                                                } else {
                                                                                    const newList = [...selectedIds, u.id.toString()];
                                                                                    field.onChange(newList);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {u.name}
                                                                            {isBaseUom && <span className="ml-1 opacity-70">(BASE)</span>}
                                                                            {isSelected && !isBaseUom && <Plus className="ml-1.5 h-2.5 w-2.5 inline-block rotate-45" />}
                                                                        </Badge>
                                                                    );
                                                                })
                                                            }
                                                        </>
                                                    )}
                                                </div>
                                                <FormDescription className="text-[9px]">
                                                    Seleccione las unidades permitidas para vender este producto. La unidad base siempre es permitida.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border bg-card/50">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                            <Warehouse className="h-4 w-4" />
                            Control de Inventario
                        </h3>

                        <FormField<ProductFormValues>
                            control={form.control}
                            name="track_inventory"
                            render={({ field }) => (
                                <div className="space-y-4">
                                    {productType === 'MANUFACTURABLE' ? (
                                        <div className={cn("flex items-center justify-between p-4 rounded-xl border bg-primary/5 border-primary/20", FORM_STYLES.card)}>
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <FormLabel className={FORM_STYLES.label}>Control de Inventario</FormLabel>
                                                    <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 uppercase font-black">Automático</Badge>
                                                </div>
                                                <FormDescription className="text-[10px]">
                                                    Gestionado por el Modo de Producción seleccionado.
                                                </FormDescription>
                                            </div>
                                            <div className="flex items-center gap-2 cursor-help" title={field.value ? "Activado (Simple/Lote)" : "Desactivado (Sobre Pedido)"}>
                                                <Switch
                                                    checked={field.value}
                                                    disabled
                                                    className="opacity-50"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <FormItem className={cn("flex items-center justify-between p-4 rounded-xl border bg-background/50", FORM_STYLES.card)}>
                                            <div className="space-y-0.5">
                                                <FormLabel className={FORM_STYLES.label}>Controlar Stock</FormLabel>
                                                <FormDescription className="text-[10px]">
                                                    {productType === 'STORABLE' ? 'Obligatorio para productos almacenables.' :
                                                        productType === 'SERVICE' || productType === 'CONSUMABLE' ? 'Desactivado para servicios y consumibles.' :
                                                            'Habilitar si desea rastrear cantidades en stock.'}
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSwitchDisabled}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}

                                    {field.value && (
                                        <div className="space-y-4 pt-2 border-t mt-4 animate-in fade-in slide-in-from-top-1 bg-background/30 p-4 rounded-xl">
                                            <FormField<ProductFormValues>
                                                control={form.control}
                                                name="receiving_warehouse"
                                                render={({ field: whField }) => (
                                                    <FormItem className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Warehouse className="h-3.5 w-3.5 text-primary" />
                                                            <FormLabel className={FORM_STYLES.label}>Bodega de Recepción por Defecto</FormLabel>
                                                        </div>
                                                        <FormControl>
                                                            <select
                                                                className={cn(FORM_STYLES.input, "flex h-9 w-full px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring")}
                                                                {...whField}
                                                            >
                                                                <option value="">Seleccionar bodega...</option>
                                                                {warehouses.map((wh) => (
                                                                    <option key={wh.id} value={wh.id.toString()}>{wh.name}</option>
                                                                ))}
                                                            </select>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField<ProductFormValues>
                                                control={form.control}
                                                name="preferred_supplier"
                                                render={({ field: supplierField }) => (
                                                    <FormItem className="space-y-1 mt-4">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-3.5 w-3.5 text-primary" />
                                                            <FormLabel className={FORM_STYLES.label}>Proveedor Preferido</FormLabel>
                                                        </div>
                                                        <FormControl>
                                                            <AdvancedContactSelector
                                                                value={supplierField.value || ""}
                                                                onChange={supplierField.onChange}
                                                                contactType="SUPPLIER"
                                                                placeholder="Seleccionar proveedor preferido..."
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {field.value && initialData && (
                                        <div className={cn("grid grid-cols-3 gap-2 p-3 bg-muted/20", FORM_STYLES.card)}>
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
        </TabsContent>
    )
}
