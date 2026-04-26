"use client"

import { FormField } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Package, Warehouse, ChevronDown, Search, Check, Truck, AlertCircle } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Button } from "@/components/ui/button"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

import { LabeledContainer, FormTabsContent, FormSection } from "@/components/shared"
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
        <FormTabsContent value="logistics" className="mt-0 space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-4 gap-8 items-start">
                {/* Units Section */}
                <div className="col-span-2 space-y-4">
                    <FormSection title="Unidades y Conversión" icon={Package} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="uom"
                                render={({ field, fieldState }) => (
                                    <LabeledContainer
                                        label="Unidad de Stock (Base)"
                                        error={fieldState.error?.message}
                                    >
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                >
                                                    <span>
                                                        {field.value
                                                            ? uoms.find((u) => u.id.toString() === field.value?.toString())?.name
                                                            : "Seleccionar unidad base..."}
                                                    </span>
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                                    <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin">
                                                        {uoms.map((u) => (
                                                            <div
                                                                key={u.id}
                                                                className={cn(
                                                                    "uom-base-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
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
                                    </LabeledContainer>
                                )}
                            />
                        </div>

                        <div className="col-span-2">
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="purchase_uom"
                                render={({ field, fieldState }) => (
                                    <LabeledContainer
                                        label="Unidad de Compra"
                                        error={fieldState.error?.message}
                                    >
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                >
                                                    <span>
                                                        {field.value
                                                            ? uoms.find((u) => String(u.id) === String(field.value))?.name
                                                            : "Igual a Stock"}
                                                    </span>
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                                    <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin">
                                                        <div
                                                            className={cn(
                                                                "uom-purchase-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
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
                                                                    "uom-purchase-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
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
                                    </LabeledContainer>
                                )}
                            />
                        </div>

                        <div className="col-span-2">
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
                                            <LabeledContainer
                                                label="Unidades de Venta Permitidas"
                                                error={fieldState.error?.message}
                                            >
                                                <div className="flex flex-col gap-3 p-4">
                                                    <div className="flex flex-wrap gap-2 p-3 rounded-xl border-2 border-dashed bg-muted/10 min-h-[60px] items-center">
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
                                <LabeledContainer
                                    label="Control de Existencias"
                                >
                                    <div className="flex items-center justify-between w-full pr-4 py-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-widest">Seguimiento Activo</span>
                                            {productType === 'MANUFACTURABLE' && (
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Automático</span>
                                            )}
                                        </div>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isSwitchDisabled}
                                        />
                                    </div>
                                </LabeledContainer>

                                {field.value && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-400">
                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="receiving_warehouse"
                                            render={({ field: whField, fieldState }) => (
                                                <LabeledContainer
                                                    label="Bodega de Recepción"
                                                    error={fieldState.error?.message}
                                                >
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                role="combobox"
                                                                className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !whField.value && "text-muted-foreground")}
                                                            >
                                                                <span>
                                                                    {whField.value
                                                                        ? warehouses.find((wh) => wh.id.toString() === whField.value?.toString())?.name
                                                                        : "Seleccionar bodega predeterminada..."}
                                                                </span>
                                                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                            <div className="p-2">
                                                                <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                        placeholder="Buscar..."
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
                                                                <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin">
                                                                    {warehouses.map((wh) => (
                                                                        <div
                                                                            key={wh.id}
                                                                            className={cn(
                                                                                "wh-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
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
                                                </LabeledContainer>
                                            )}
                                        />

                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="preferred_supplier"
                                            render={({ field: supplierField, fieldState }) => (
                                                <LabeledContainer
                                                    label="Proveedor Preferencial"
                                                    error={fieldState.error?.message}
                                                >
                                                    <div className="h-[34px]">
                                                        <AdvancedContactSelector
                                                            value={supplierField.value || ""}
                                                            onChange={supplierField.onChange}
                                                            contactType="SUPPLIER"
                                                            placeholder="Buscar proveedor..."
                                                            className="border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent h-full px-3 text-xs font-black uppercase"
                                                        />
                                                    </div>
                                                </LabeledContainer>
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
                                )}
                            </div>
                        )}
                    />
                </div>
            </div>
        </FormTabsContent>
    )
}
