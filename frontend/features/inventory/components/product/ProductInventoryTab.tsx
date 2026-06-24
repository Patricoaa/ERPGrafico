"use client"
import { useMemo } from "react"
import { FormField } from "@/components/ui/form"
import {Package, Warehouse} from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { type ProductFormValues } from "./schema"
import {FormSection, LabeledSwitch, MultiSelectTagInput} from "@/components/shared"
import { UoMSelector, WarehouseSelector, AdvancedContactSelector } from "@/components/selectors"
import { cn } from "@/lib/utils"
import { type Product, type UoM } from "@/types/entities"
import { type ProductInitialData } from "@/types/forms"

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
    const mfgAutoFinalize = form.watch("mfg_auto_finalize")
    const requiresAdvancedmfg = form.watch("requires_advanced_manufacturing")

    const purchaseUomProduct = useMemo(() => ({ uom: stockUomId } as any), [stockUomId])

    const isSimpleMfg = productType === 'MANUFACTURABLE' && !mfgAutoFinalize && !requiresAdvancedmfg
    const isAdvancedMfg = productType === 'MANUFACTURABLE' && requiresAdvancedmfg

    // Determine if switch is disabled based on requirements
    const isSwitchDisabled = productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'SERVICE' || mfgAutoFinalize || isSimpleMfg || isAdvancedMfg

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
                                        const sortedUoms = [...uoms].sort((a, b) => a.name.localeCompare(b.name));

                                        const options = stockCategoryId
                                            ? sortedUoms.filter(u => u.category === stockCategoryId).map(u => ({
                                                label: u.id.toString() === stockUomId?.toString() ? `${u.name} (BASE)` : u.name,
                                                value: u.id.toString()
                                            }))
                                            : [];

                                        return (
                                            <MultiSelectTagInput
                                                label="Unidades de Venta Permitidas"
                                                options={options}
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                error={fieldState.error?.message}
                                                disabled={!stockCategoryId}
                                                placeholder={stockCategoryId ? "Seleccionar unidades..." : "Defina primero la Unidad de Stock"}
                                                hint="* Solo unidades de la misma categoría para conversiones precisas."
                                            />
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
                                    description={mfgAutoFinalize ? "Desactivado: Los productos de fabricación express no requieren seguimiento." : isAdvancedMfg ? "Desactivado: Los productos de fabricación avanzada no requieren seguimiento." : isSimpleMfg ? "Requerido: Los productos de fabricación simple siempre controlan stock." : "Habilita el control de existencias y movimientos para este producto."}
                                    checked={field.value}
                                    onCheckedChange={(val) => {
                                        requestAnimationFrame(() => {
                                            form.setValue("track_inventory", val, { shouldDirty: true, shouldValidate: false })
                                        })
                                    }}
                                    disabled={isSwitchDisabled}
                                    icon={<Warehouse className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
                                    className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-card" : "border-dashed")}
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
                                        <div className="grid grid-cols-3 gap-1 shadow-inner overflow-hidden">
                                            <div className="flex flex-col items-center bg-background/10 py-3 rounded-md border border">
                                                <span className="text-[9px] font-black uppercase tracking-tight text-muted-foreground mb-1">A Mano</span>
                                                <span className="text-lg font-mono font-black">{initialData.current_stock || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-warning/5 py-3 rounded-md border border-warning/20">
                                                <span className="text-[9px] font-black uppercase tracking-tight text-warning/80 mb-1">Reservado</span>
                                                <span className="text-lg font-mono font-black text-warning">{initialData.qty_reserved || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-success/5 py-3 rounded-md border border-success/20">
                                                <span className="text-[9px] font-black uppercase tracking-tight text-success mb-1">Disponible</span>
                                                <span className="text-lg font-mono font-black text-success">{initialData.qty_available || 0}</span>
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
