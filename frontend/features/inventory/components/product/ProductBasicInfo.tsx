"use client"

import { FormField } from "@/components/ui/form"
import { EmptyState, LabeledInput, LabeledContainer, FormSection } from "@/components/shared"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart, Truck, Search, ChevronDown, Check, Barcode, Fingerprint, Globe } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { BarcodeModal } from "@/features/inventory/components/BarcodeModal"

import { useState } from "react"
import { ProductCategory } from "@/types/entities"

export interface ProductBasicInfoProps {
    form: UseFormReturn<ProductFormValues>
    categories: ProductCategory[]
    isEditing: boolean
    onAddCategory: () => void
}

export function ProductBasicInfo({ form, categories, isEditing, onAddCategory }: ProductBasicInfoProps) {
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false)

    return (
        <div className="space-y-8">
            {/* Identification Section */}
            <div className="space-y-4">
                <FormSection title="Identificación del Producto" icon={Fingerprint} />
                <div className="grid grid-cols-4 gap-4 items-start">
                    <div className="col-span-1">
                        <LabeledContainer
                            label="ID Sistema"
                            disabled
                            className="w-full opacity-80 bg-muted/30 border-dashed"
                        >
                            <div className="flex items-center gap-2 h-[34px] px-3">
                                <span className="text-muted-foreground text-[10px] font-mono">#</span>
                                {isEditing ? (
                                    <span className="font-mono font-black text-primary text-xs">
                                        {form.getValues("internal_code")}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter italic">Auto</span>
                                )}
                            </div>
                        </LabeledContainer>
                    </div>

                    <div className="col-span-2">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Nombre Comercial"
                                    required
                                    placeholder="Ej: Camiseta de Algodón Premium"
                                    error={fieldState.error?.message}
                                    className="text-base font-black h-[1.5rem]"
                                    {...field}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="code"
                            render={({ field, fieldState }) => (
                                <div className="flex gap-2 items-start">
                                    <LabeledInput
                                        label="SKU / EAN"
                                        placeholder="Código"
                                        error={fieldState.error?.message}
                                        className="font-mono font-bold h-[1.5rem]"
                                        containerClassName="flex-1"
                                        {...field}
                                        value={field.value || ""}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0 h-[1.5rem] w-8 rounded-md border-primary/10 hover:bg-primary/5 shadow-sm transition-all self-end mb-1"
                                        onClick={() => setIsBarcodeModalOpen(true)}
                                        title="Generador de Barras"
                                    >
                                        <Barcode className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                    <BarcodeModal
                                        open={isBarcodeModalOpen}
                                        onOpenChange={setIsBarcodeModalOpen}
                                        initialValue={field.value}
                                        onApply={(val) => form.setValue("code", val, { shouldDirty: true, shouldValidate: true })}
                                    />
                                </div>
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Classification Section */}
            <div className="space-y-4">
                <FormSection title="Clasificación y Disponibilidad" icon={Globe} />
                <div className="grid grid-cols-4 gap-6 items-end">
                    <div className="col-span-2">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="category"
                            render={({ field, fieldState }) => (
                                <div className="flex gap-2 items-start">
                                    <LabeledContainer
                                        label="Categoría del Producto"
                                        error={fieldState.error?.message}
                                        disabled={isEditing}
                                        className={cn("flex-1", isEditing && "opacity-80 bg-muted/5")}
                                    >
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    disabled={isEditing}
                                                    className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                >
                                                    {field.value
                                                        ? categories.find((cat) => cat.id.toString() === field.value.toString())?.name
                                                        : "Seleccionar categoría"}
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                <div className="p-2">
                                                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        <input
                                                            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                            placeholder="Buscar categoría..."
                                                            onChange={(e) => {
                                                                const val = e.target.value.toLowerCase()
                                                                const inputs = document.querySelectorAll('.category-item')
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
                                                        {categories.map((cat) => (
                                                            <div
                                                                key={cat.id}
                                                                className={cn(
                                                                    "category-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                                                                    field.value === cat.id.toString() && "bg-accent"
                                                                )}
                                                                onClick={() => {
                                                                    field.onChange(cat.id.toString())
                                                                    document.body.click()
                                                                }}
                                                            >
                                                                <span>{cat.name}</span>
                                                                {field.value === cat.id.toString() && (
                                                                    <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                )}
                                                            </div>
                                                        ))}
                                                        {categories.length === 0 && (
                                                            <EmptyState context="inventory" variant="compact" title="Sin categorías" />
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </LabeledContainer>
                                    {!isEditing && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="shrink-0 h-[1.5rem] w-8 rounded-md border-primary/10 hover:bg-primary/5 shadow-sm transition-all self-end mb-1"
                                            onClick={onAddCategory}
                                            title="Nueva Categoría"
                                        >
                                            <Plus className="h-4 w-4 text-primary" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        />
                    </div>

                    <div className="col-span-2 flex items-center gap-4 bg-muted/20 border border-dashed rounded-lg px-4 py-2">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="can_be_sold"
                            render={({ field }) => (
                                <div className="flex-1 flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 cursor-pointer">
                                        <ShoppingCart className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-emerald-500" : "text-muted-foreground/30")} />
                                        Venta
                                    </label>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={['CONSUMABLE', 'SUBSCRIPTION'].includes(form.watch("product_type"))}
                                    />
                                </div>
                            )}
                        />

                        <div className="w-px h-6 bg-border" />

                        <FormField<ProductFormValues>
                            control={form.control}
                            name="can_be_purchased"
                            render={({ field }) => (
                                <div className="flex-1 flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 cursor-pointer">
                                        <Truck className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-amber-500" : "text-muted-foreground/30")} />
                                        Compra
                                    </label>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={form.watch("product_type") === 'MANUFACTURABLE'}
                                    />
                                </div>
                            )}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
