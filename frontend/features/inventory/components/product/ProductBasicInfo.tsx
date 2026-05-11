"use client"

import { FormField } from "@/components/ui/form"
import { EmptyState, LabeledInput, LabeledContainer, FormSection, LabeledSwitch } from "@/components/shared"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Truck, Barcode, Fingerprint, Globe, Tag } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { BarcodeModal } from "@/features/inventory/components/BarcodeModal"

import { useState } from "react"
import { CategorySelector, ProductTypeSelector } from "@/components/selectors"

export interface ProductBasicInfoProps {
    form: UseFormReturn<ProductFormValues>
    isEditing: boolean
    imagePreview: string | null
    setImagePreview: (value: string | null) => void
    lockedType?: string
}

import { Label } from "@/components/ui/label"
import { ProductImageUpload } from "./ProductImageUpload"

export function ProductBasicInfo({ form, isEditing, imagePreview, setImagePreview, lockedType }: ProductBasicInfoProps) {
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false)
    const productType = form.watch("product_type")

    return (
        <div className="space-y-8">
            {/* Identification and Classification Section - 4-Column Refined Layout */}
            <div className="space-y-4">
                <FormSection title="Identificación y Clasificación" icon={Fingerprint} />
                <div className="grid grid-cols-4 gap-4 items-start">
                    {/* Fila 1: Nombre (3) / Imagen (1) */}
                    <div className="col-span-3">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Nombre Comercial del Producto"
                                    required
                                    placeholder="Ej: Camiseta de Algodón Premium"
                                    error={fieldState.error?.message}
                                    className="font-bold text-xs h-[1.5rem]"
                                    {...field}
                                />
                            )}
                        />
                    </div>
                    <div className="col-span-1 row-span-3">
                        <ProductImageUpload
                            form={form}
                            imagePreview={imagePreview}
                            setImagePreview={setImagePreview}
                        />
                    </div>

                    <div className="col-span-1">
                        <LabeledContainer
                            label="ID Sistema"
                            disabled
                            className="w-full opacity-80 bg-muted/30 border-dashed"
                        >
                            <div className="flex items-center gap-2 h-full px-3">
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

                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="can_be_sold"
                            render={({ field }) => (
                                <LabeledSwitch
                                    label="Venta"
                                    checked={field.value}
                                    onCheckedChange={(val) => {
                                        requestAnimationFrame(() => {
                                            field.onChange(val)
                                        })
                                    }}
                                    disabled={['CONSUMABLE', 'SUBSCRIPTION'].includes(productType)}
                                    icon={<ShoppingCart className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-emerald-600" : "text-muted-foreground/40")} />}
                                    className={cn(
                                        "h-full transition-all duration-300", 
                                        field.value 
                                            ? "bg-emerald-500/10 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10" 
                                            : "bg-muted/5 border-border/60 hover:border-border"
                                    )}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="can_be_purchased"
                            render={({ field }) => (
                                <LabeledSwitch
                                    label="Compra"
                                    checked={field.value}
                                    onCheckedChange={(val) => {
                                        requestAnimationFrame(() => {
                                            field.onChange(val)
                                        })
                                    }}
                                    disabled={productType === 'MANUFACTURABLE'}
                                    icon={<Truck className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-amber-600" : "text-muted-foreground/40")} />}
                                    className={cn(
                                        "h-full transition-all duration-300", 
                                        field.value 
                                            ? "bg-amber-500/10 border-amber-500/30 shadow-sm ring-1 ring-amber-500/10" 
                                            : "bg-muted/5 border-border/60 hover:border-border"
                                    )}
                                />
                            )}
                        />
                    </div>

                    {/* Fila 3: Tipo (1) / Categoría (2) / Empty (1) */}
                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="product_type"
                            render={({ field, fieldState }) => (
                                <ProductTypeSelector
                                    value={field.value}
                                    onChange={(val) => {
                                        field.onChange(val);
                                        if (val === 'STORABLE') {
                                            form.setValue('track_inventory', true);
                                            form.setValue('can_be_purchased', true);
                                        } else if (val === 'MANUFACTURABLE') {
                                            form.setValue('track_inventory', true);
                                            form.setValue('can_be_purchased', false);
                                            form.setValue('is_dynamic_pricing', false);
                                        } else {
                                            form.setValue('track_inventory', false);
                                            form.setValue('is_dynamic_pricing', false);
                                        }
                                    }}
                                    disabled={isEditing} 
                                    lockedType={lockedType} 
                                    error={fieldState.error?.message}
                                    required 
                                />
                            )}
                        />
                    </div>
                    <div className="col-span-2">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="category"
                            render={({ field, fieldState }) => (
                                <CategorySelector
                                    label="Categoría del Producto"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                    disabled={false}
                                    required
                                />
                            )}
                        />
                    </div>
                    <div className="col-span-1" />

                    {/* Fila 4: SKU (Propietary Row) */}
                    <div className="col-span-4">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="code"
                            render={({ field, fieldState }) => (
                                <div className="flex gap-2 items-start">
                                    <LabeledInput
                                        label="Código SKU / EAN / Barras"
                                        placeholder="Código"
                                        error={fieldState.error?.message}
                                        className="font-mono font-bold text-xs h-[1.5rem]"
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
        </div>
    )
}
