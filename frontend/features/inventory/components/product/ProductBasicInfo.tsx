"use client"

import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledContainer, FormSection, LabeledSwitch, NotchedButton } from "@/components/shared"
import { ShoppingCart, Truck, Barcode, Fingerprint, Layers } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
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

import { ProductImageUpload } from "./ProductImageUpload"

export function ProductBasicInfo({ form, isEditing, imagePreview, setImagePreview, lockedType }: ProductBasicInfoProps) {
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false)
    const productType = form.watch("product_type")

    return (
        <div className="space-y-8">
            {/* Identification and Classification Section - 4-Column Refined Layout */}
            <div className="space-y-4">
                <FormSection title="Identificación y Clasificación" icon={Fingerprint} />
                <div className="grid grid-cols-4 gap-4 items-stretch">
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
                    <div className="col-span-1 row-span-3 h-full">
                        <ProductImageUpload
                            form={form}
                            imagePreview={imagePreview}
                            setImagePreview={setImagePreview}
                        />
                    </div>

                    <div className="col-span-1">
                        <LabeledContainer
                            label="ID"
                            disabled
                            className="w-full opacity-80 bg-muted/30"
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
                                            form.setValue("can_be_sold", val, { shouldDirty: true, shouldValidate: false })
                                        })
                                    }}
                                    disabled={false}
                                    icon={<ShoppingCart className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-success" : "text-muted-foreground/60")} />}
                                    className={cn(
                                        "h-full transition-all duration-300",
                                        field.value
                                            ? "bg-success/10 border-success/30 shadow-sm ring-1 ring-success/10"
                                            : "bg-background border-border hover:border-muted-foreground/30 hover:bg-muted/10 shadow-[inset_0_1px_2px_oklch(0.12_0.02_240_/_0.1)] dark:shadow-[inset_0_1px_2px_oklch(1_0_0_/_0.02)]"
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
                                            form.setValue("can_be_purchased", val, { shouldDirty: true, shouldValidate: false })
                                        })
                                    }}
                                    disabled={['STORABLE', 'MANUFACTURABLE'].includes(productType)}
                                    icon={<Truck className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-warning" : "text-muted-foreground/40")} />}
                                    className={cn(
                                        "h-full transition-all duration-300",
                                        field.value
                                            ? "bg-warning/10 border-warning/30 shadow-sm ring-1 ring-warning/10"
                                            : "bg-background border-border hover:border-muted-foreground/30 hover:bg-muted/10 shadow-[inset_0_1px_2px_oklch(0.12_0.02_240_/_0.1)] dark:shadow-[inset_0_1px_2px_oklch(1_0_0_/_0.02)]"
                                    )}
                                />
                            )}
                        />
                    </div>

                    {/* Fila 3: Tipo (1) / Categoría (2) / Variantes (1) */}
                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="product_type"
                            render={({ field, fieldState }) => (
                                <ProductTypeSelector
                                    value={field.value}
                                    onChange={(val) => {
                                        requestAnimationFrame(() => {
                                            field.onChange(val);
                                            const opts = { shouldDirty: true, shouldValidate: false };
                                            if (val === 'STORABLE') {
                                                form.setValue('track_inventory', true, opts);
                                                form.setValue('can_be_purchased', true, opts);
                                            } else if (val === 'MANUFACTURABLE') {
                                                form.setValue('track_inventory', true, opts);
                                                form.setValue('can_be_purchased', false, opts);
                                                form.setValue('is_dynamic_pricing', false, opts);
                                            } else {
                                                form.setValue('track_inventory', false, opts);
                                                form.setValue('is_dynamic_pricing', false, opts);
                                            }
                                        });
                                    }}
                                    disabled={isEditing}
                                    lockedType={lockedType}
                                    error={fieldState.error?.message}
                                    required
                                />
                            )}
                        />
                    </div>
                    <div className="col-span-1">
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
                    <div className="col-span-1">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="has_variants"
                            render={({ field }) => (
                                <LabeledSwitch
                                    label="Variantes"
                                    checked={field.value}
                                    onCheckedChange={(val) => {
                                        requestAnimationFrame(() => {
                                            form.setValue("has_variants", val, { shouldDirty: true, shouldValidate: false })
                                        })
                                    }}
                                    disabled={isEditing}
                                    icon={<Layers className={cn("h-3.5 w-3.5 transition-colors", field.value ? "text-primary" : "text-muted-foreground/40")} />}
                                    className={cn(
                                        "h-full transition-all duration-300",
                                        field.value
                                            ? "bg-primary/10 border-primary/30 shadow-sm ring-1 ring-primary/10"
                                            : "bg-background border-border hover:border-muted-foreground/30 hover:bg-muted/10 shadow-[inset_0_1px_2px_oklch(0.12_0.02_240_/_0.1)] dark:shadow-[inset_0_1px_2px_oklch(1_0_0_/_0.02)]"
                                    )}
                                />
                            )}
                        />
                    </div>

                    {/* Fila 4: SKU (Propietary Row) */}
                    <div className="col-span-4">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="code"
                            render={({ field, fieldState }) => (
                                <div className="flex items-stretch gap-2">
                                    <LabeledInput
                                        label="Código SKU / EAN / Barras"
                                        placeholder="Código"
                                        error={fieldState.error?.message}
                                        className="font-mono font-bold text-xs h-[1.5rem]"
                                        containerClassName="flex-1 min-w-0"
                                        {...field}
                                        value={field.value || ""}
                                    />
                                    <NotchedButton
                                        className="shrink-0 w-12"
                                        onClick={() => setIsBarcodeModalOpen(true)}
                                        title="Generador de Barras"
                                    >
                                        <Barcode className="h-4 w-4 text-primary" />
                                    </NotchedButton>
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
