"use client"

import { FormField } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Package, Settings2, Plus, Warehouse, ChevronsUpDown, Search, Check, Truck, AlertCircle } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Card } from "@/components/ui/card"

import { useState } from "react"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Product, UoM } from "@/types/entities"
import { ProductInitialData } from "@/types/forms"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: ProductInitialData | (Partial<Product> & { qty_reserved?: number })
    warehouses?: { id: number, name: string }[]
    uoms?: UoM[]
}

export function ProductInventoryTab({ form, initialData, warehouses = [], uoms = [] }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")
    const trackInventory = form.watch("track_inventory")

    // Determine if switch is disabled based on requirements
    const isSwitchDisabled = productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'SERVICE'

    return (
        <TabsContent value="logistics" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="relative p-5 pt-8 rounded-lg border-2 bg-card shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Unidades y Conversión</span>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="uom"
                                render={({ field, fieldState }) => (
                                    <fieldset className={cn("notched-field w-full group transition-all h-[50px]", fieldState.error && "error")}>
                                        <legend className={cn("notched-legend", fieldState.error && "text-destructive")}>Unidad de Stock (Base)</legend>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    className={cn("w-full justify-between font-black text-xs h-full px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Package className="h-4 w-4 text-primary" />
                                                        <span>
                                                            {field.value
                                                                ? uoms.find((u) => u.id.toString() === field.value?.toString())?.name
                                                                : "Seleccionar unidad base..."}
                                                        </span>
                                                    </div>
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
                                                                const inputs = document.querySelectorAll('.uom-base-item')
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
                                                        {uoms.map((u) => (
                                                            <div
                                                                key={u.id}
                                                                className={cn(
                                                                    "uom-base-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
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
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </fieldset>
                                )}
                            />

                            <FormField<ProductFormValues>
                                control={form.control}
                                name="purchase_uom"
                                render={({ field, fieldState }) => (
                                    <fieldset className={cn("notched-field w-full group transition-all h-[50px]", fieldState.error && "error")}>
                                        <legend className={cn("notched-legend", fieldState.error && "text-destructive")}>Unidad de Compra</legend>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    className={cn("w-full justify-between font-black text-xs h-full px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Truck className="h-4 w-4 text-warning" />
                                                        <span>
                                                            {field.value
                                                                ? uoms.find((u) => String(u.id) === String(field.value))?.name
                                                                : "Igual a Stock"}
                                                        </span>
                                                    </div>
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
                                                                const inputs = document.querySelectorAll('.uom-purchase-item')
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
                                                        <div
                                                            className={cn(
                                                                "uom-purchase-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                !field.value && "bg-accent"
                                                            )}
                                                            onClick={() => {
                                                                field.onChange("")
                                                                document.body.click()
                                                            }}
                                                        >
                                                            <span className="italic text-muted-foreground">Igual a Stock</span>
                                                            {!field.value && (
                                                                <Check className="ml-auto h-4 w-4 opacity-100" />
                                                            )}
                                                        </div>
                                                        {uoms.map((u) => (
                                                            <div
                                                                key={u.id}
                                                                className={cn(
                                                                    "uom-purchase-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
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
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </fieldset>
                                )}
                            />

                            {form.watch("can_be_sold") && (
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="allowed_sale_uoms"
                                    render={({ field, fieldState }) => {
                                        const stockUomId = form.watch("uom");
                                        const stockUom = uoms.find(u => u.id.toString() === stockUomId?.toString());
                                        const stockCategoryId = stockUom?.category;
                                        const selectedIds = field.value || [];
                                        const sortedUoms = [...uoms].sort((a, b) => a.name.localeCompare(b.name));

                                        return (
                                            <fieldset className={cn("notched-field w-full group transition-all", fieldState.error && "error")}>
                                                <legend className={cn("notched-legend", fieldState.error && "text-destructive")}>Unidades de Venta Permitidas</legend>
                                                <div className="flex flex-col gap-4 p-4">
                                                    <div className="flex flex-wrap gap-2 p-3 rounded-md border-2 border-dashed bg-muted/5 min-h-[60px] items-center">
                                                        {!stockCategoryId ? (
                                                            <div className="w-full flex items-center justify-center gap-2 text-[10px] text-muted-foreground italic">
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
                                                                                    "px-3 py-1.5 rounded-md text-[10px] transition-all border-2",
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
                                                    <p className="text-[9px] text-muted-foreground/80 leading-relaxed italic">
                                                        * Solo se muestran unidades de la misma categoría que la unidad base para asegurar conversiones válidas.
                                                    </p>
                                                </div>
                                            </fieldset>
                                        );
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Control y Abastecimiento</span>
                    </div>

                    <FormField<ProductFormValues>
                        control={form.control}
                        name="track_inventory"
                        render={({ field }) => (
                            <div className="space-y-6">
                                <div className={cn(
                                    "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                                    field.value ? "bg-success/5 border-success/20" : "bg-background border-dashed border-muted-foreground/20"
                                )}>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-widest">Controlar Stock</span>
                                            {productType === 'MANUFACTURABLE' && (
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Auto</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            Habilitar el seguimiento de cantidades físicas en bodegas.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isSwitchDisabled}
                                    />
                                </div>

                                {field.value && (
                                    <div className="space-y-6 pt-4 animate-in fade-in zoom-in-95 duration-300">
                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="receiving_warehouse"
                                            render={({ field: whField, fieldState }) => (
                                                <fieldset className={cn("notched-field w-full group transition-all h-[50px]", fieldState.error && "error")}>
                                                    <legend className={cn("notched-legend", fieldState.error && "text-destructive")}>Bodega de Recepción</legend>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                role="combobox"
                                                                className={cn("w-full justify-between font-black text-xs h-full px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !whField.value && "text-muted-foreground")}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Warehouse className="h-4 w-4 text-primary" />
                                                                    <span>
                                                                        {whField.value
                                                                            ? warehouses.find((wh) => wh.id.toString() === whField.value?.toString())?.name
                                                                            : "Seleccionar bodega por defecto..."}
                                                                    </span>
                                                                </div>
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                            <div className="p-2">
                                                                <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                        placeholder="Buscar bodega..."
                                                                        onChange={(e) => {
                                                                            const val = e.target.value.toLowerCase()
                                                                            const inputs = document.querySelectorAll('.wh-item')
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
                                                                    {warehouses.map((wh) => (
                                                                        <div
                                                                            key={wh.id}
                                                                            className={cn(
                                                                                "wh-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                                whField.value === wh.id.toString() && "bg-accent"
                                                                            )}
                                                                            onClick={() => {
                                                                                whField.onChange(wh.id.toString())
                                                                                document.body.click()
                                                                            }}
                                                                        >
                                                                            <span>{wh.name}</span>
                                                                            {whField.value === wh.id.toString() && (
                                                                                <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </fieldset>
                                            )}
                                        />

                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="preferred_supplier"
                                            render={({ field: supplierField, fieldState }) => (
                                                <fieldset className={cn("notched-field w-full group transition-all h-[50px]", fieldState.error && "error")}>
                                                    <legend className={cn("notched-legend", fieldState.error && "text-destructive")}>Proveedor Preferencial</legend>
                                                    <div className="h-full">
                                                        <AdvancedContactSelector
                                                            value={supplierField.value || ""}
                                                            onChange={supplierField.onChange}
                                                            contactType="SUPPLIER"
                                                            placeholder="Buscar proveedor..."
                                                            className="border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent h-full px-3 text-xs font-black uppercase"
                                                        />
                                                    </div>
                                                </fieldset>
                                            )}
                                        />

                                        {initialData && (
                                            <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-background border-2 shadow-inner">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">A Mano</span>
                                                    <span className="text-xl font-mono font-black">{initialData.current_stock || 0}</span>
                                                </div>
                                                <div className="flex flex-col items-center border-x-2 border-dashed">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-warning mb-1">Reservado</span>
                                                    <span className="text-xl font-mono font-black text-warning">{initialData.qty_reserved || 0}</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-success mb-1">Disponible</span>
                                                    <span className="text-xl font-mono font-black text-success">{initialData.qty_available || 0}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    />
                </div>
            </div>
        </TabsContent>
    )
}
