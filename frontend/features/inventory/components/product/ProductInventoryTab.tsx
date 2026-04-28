"use client"
import { useMemo } from "react"
import { FormField } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Package, Warehouse, ChevronDown, Search, Check, Truck, AlertCircle } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Button } from "@/components/ui/button"
import { LabeledContainer, FormTabsContent, FormSection, LabeledSwitch } from "@/components/shared"
import { UoMSelector, WarehouseSelector, AdvancedContactSelector } from "@/components/selectors"
import { cn } from "@/lib/utils"
import { Product, UoM } from "@/types/entities"
import { ProductInitialData } from "@/types/forms"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: ProductInitialData | (Partial<Product> & { qty_reserved?: number })
    warehouses?: { id: number, name: string }[]
    uoms?: UoM[]
    isEditing?: boolean
}

export function ProductInventoryTab({ form, initialData, warehouses = [], uoms = [], isEditing }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")
    const trackInventory = form.watch("track_inventory")
    const canBeSold = form.watch("can_be_sold")
    const stockUomId = form.watch("uom")

    const purchaseUomProduct = useMemo(() => ({ uom: stockUomId } as any), [stockUomId])

    // Determine if switch is disabled based on requirements
    const isSwitchDisabled = productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'SERVICE'

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-10 items-start">
                {/* Units Section */}
                <div className="col-span-2 space-y-4">
                    <FormSection title="Unidades y Conversión" icon={Package} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="uom"
                                render={({ field, fieldState }) => (
                                    <UoMSelector
                                        label="Unidad de Stock (Base)"
                                        variant="standalone"
                                        required
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        uoms={uoms}
                                        error={fieldState.error?.message}
                                        disabled={isEditing}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-2">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="purchase_uom"
                                render={({ field, fieldState }) => (
                                    <UoMSelector
                                        label="Unidad de Compra"
                                        variant="standalone"
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        uoms={uoms}
                                        product={purchaseUomProduct}
                                        context="purchase"
                                        error={fieldState.error?.message}
                                        disabled={!stockUomId}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-2">
                            {canBeSold && (
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="allowed_sale_uoms"
                                    render={({ field, fieldState }) => {
                                        const stockUom = uoms.find(u => u.id.toString() === stockUomId?.toString());
                                        const stockCategoryId = stockUom?.category;
                                        const selectedIds = field.value || [];
                                        const sortedUoms = [...uoms].sort((a, b) => a.name.localeCompare(b.name));

                                        return (
                                            <LabeledContainer
                                                label="Unidades de Venta Permitidas"
                                                error={fieldState.error?.message}
                                            >
                                                <div className="flex flex-col gap-3 p-3 w-full">
                                                    <div className="flex flex-wrap gap-2 items-center w-full">
                                                        {!stockCategoryId ? (
                                                            <div className="w-full flex items-center gap-2 text-[10px] text-muted-foreground italic">
                                                                <AlertCircle className="h-3 w-3" />
                                                                Defina primero la Unidad de Stock.
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {sortedUoms
                                                                    .filter(u => u.category === stockCategoryId)
                                                                    .map((u: UoM) => {
                                                                        const isSelected = selectedIds.includes(u.id.toString());
                                                                        const isBaseUom = u.id.toString() === stockUomId?.toString();

                                                                        return (
                                                                            <button
                                                                                key={u.id}
                                                                                type="button"
                                                                                className={cn(
                                                                                    "px-3 py-1.5 rounded-lg text-[10px] transition-all border-2",
                                                                                    isSelected
                                                                                        ? "bg-primary/10 border-primary/40 text-primary font-black shadow-sm"
                                                                                        : "bg-background border-primary/5 hover:border-primary/20 text-muted-foreground/60 font-black uppercase tracking-tight",
                                                                                    isBaseUom && "ring-2 ring-primary ring-offset-2"
                                                                                )}
                                                                                onClick={() => {
                                                                                    if (isSelected) {
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
                                                                                {isBaseUom && <span className="ml-1 opacity-50">(BASE)</span>}
                                                                            </button>
                                                                        );
                                                                    })
                                                                }
                                                            </>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-muted-foreground/60 leading-relaxed italic">
                                                        * Solo unidades de la misma categoría para conversiones precisas.
                                                    </p>
                                                </div>
                                            </LabeledContainer>
                                        );
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Logistics Section */}
                <div className="col-span-2 space-y-4">
                    <FormSection title="Control y Abastecimiento" icon={Warehouse} />
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="track_inventory"
                        render={({ field }) => (
                            <div className="space-y-6">
                                <LabeledSwitch
                                    label="Seguimiento de Inventario"
                                    description="Habilita el control de existencias y movimientos para este producto."
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isSwitchDisabled}
                                    icon={<Warehouse className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
                                    className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
                                />

                                {/* Kept mounted with CSS visibility — avoids unmount of Radix Popover-based selectors during production-mode commits, which would loop via usePresence/safelyDetachRef. */}
                                <div className={cn("space-y-4 animate-in fade-in slide-in-from-top-2 duration-400", !field.value && "hidden")}>
                                    <FormField<ProductFormValues>
                                        control={form.control}
                                        name="receiving_warehouse"
                                        render={({ field: whField, fieldState }) => (
                                            <WarehouseSelector
                                                label="Bodega de Recepción"
                                                value={whField.value}
                                                onChange={whField.onChange}
                                                error={fieldState.error?.message}
                                                disabled={isEditing}
                                            />
                                        )}
                                    />

                                    <FormField<ProductFormValues>
                                        control={form.control}
                                        name="preferred_supplier"
                                        render={({ field: supplierField, fieldState }) => (
                                            <AdvancedContactSelector
                                                label="Proveedor Preferencial"
                                                value={supplierField.value || ""}
                                                onChange={supplierField.onChange}
                                                contactType="SUPPLIER"
                                                placeholder="Buscar proveedor..."
                                                error={fieldState.error?.message}
                                            />
                                        )}
                                    />

                                    {initialData && (
                                        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-muted/20 border shadow-inner overflow-hidden">
                                            <div className="flex flex-col items-center bg-background/60 py-3 rounded-xl border border-dashed">
                                                <span className="text-[9px] font-black uppercase tracking-tight text-muted-foreground mb-1">A Mano</span>
                                                <span className="text-lg font-mono font-black">{initialData.current_stock || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-background/60 py-3 rounded-xl border border-dashed">
                                                <span className="text-[9px] font-black uppercase tracking-tight text-amber-600/80 mb-1">Reservado</span>
                                                <span className="text-lg font-mono font-black text-amber-600">{initialData.qty_reserved || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-emerald-500/5 py-3 rounded-xl border border-emerald-500/20">
                                                <span className="text-[9px] font-black uppercase tracking-tight text-emerald-600 mb-1">Disponible</span>
                                                <span className="text-lg font-mono font-black text-emerald-600">{initialData.qty_available || 0}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
        </div>
    )
}
