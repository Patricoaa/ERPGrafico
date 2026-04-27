"use client"

import { UoM, Product } from "@/types/entities"
import { LabeledInput, LabeledContainer, FormSection, FormTabsContent, LabeledSwitch, LabeledSeparator } from "@/components/shared"
import { FormField } from "@/components/ui/form"
import { EmptyState } from "@/components/shared/EmptyState"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Package, Plus, Trash2, Layers, Check, ChevronUp, ChevronDown, X, Clock, Settings2, Search, Monitor, Printer, Scissors } from "lucide-react"
import { UseFormReturn, useFieldArray } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { ProductInitialData } from "@/types/forms"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { useState } from "react"
import { BOMManager } from "@/features/production/components/BOMManager"
import { ProductSelector, UoMSelector } from "@/components/selectors"

interface ProductManufacturingTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: ProductInitialData
    products: Product[]
    uoms: UoM[]
    variantMode?: boolean
}

export function ProductManufacturingTab({ form, products, uoms, variantMode = false, initialData }: ProductManufacturingTabProps) {
    const { fields: bomFields, append: appendBom, remove: removeBom } = useFieldArray({
        control: form.control,
        name: "boms"
    })

    const hasBom = form.watch("has_bom")
    const isEditing = !!initialData
    const requiresAdvancedmfg = form.watch("requires_advanced_manufacturing")
    const isExpress = form.watch("mfg_auto_finalize")
    const hasVariants = form.watch("has_variants")
    const productionMode = requiresAdvancedmfg ? "advanced" : (isExpress ? "express" : "simple")

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {!variantMode && (
                    <div className="md:col-span-5 space-y-6">
                        <div className="space-y-6">
                            <FormSection title="Ajustes de Producción" icon={Settings2} />

                            <div className="space-y-6">

                                <LabeledContainer
                                    label="Modo de Producción"

                                >
                                    <Tabs
                                        value={productionMode}
                                        onValueChange={(value) => {
                                            if (value === productionMode) return;
                                            const patch =
                                                value === "simple" ? { requires_advanced_manufacturing: false, mfg_auto_finalize: false, track_inventory: true }
                                                : value === "express" ? { has_bom: true, requires_advanced_manufacturing: false, mfg_auto_finalize: true, track_inventory: false }
                                                : { has_bom: true, requires_advanced_manufacturing: true, mfg_auto_finalize: false, track_inventory: false };
                                            
                                            Object.entries(patch).forEach(([k, v]) => {
                                                if (form.getValues(k as any) !== v) {
                                                    form.setValue(k as any, v as any, { shouldDirty: true, shouldValidate: false, shouldTouch: false });
                                                }
                                            });
                                        }}
                                        className="w-full"
                                    >
                                        <TabsList className="grid w-full grid-cols-3 h-20 bg-transparent p-1 border-none shadow-none">
                                            <TabsTrigger value="simple" className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-muted/30 data-[state=active]:border-primary/20 data-[state=active]:shadow-none border-2 border-transparent">
                                                <Package className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">Simple</span>
                                                <span className="text-[8px] text-muted-foreground font-medium leading-tight text-center">Manual / Lote</span>
                                            </TabsTrigger>
                                            <TabsTrigger value="express" className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-muted/30 data-[state=active]:border-primary/20 data-[state=active]:shadow-none border-2 border-transparent">
                                                <Clock className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">Express</span>
                                                <span className="text-[8px] text-muted-foreground font-medium leading-tight text-center">Auto-cierre</span>
                                            </TabsTrigger>
                                            <TabsTrigger value="advanced" className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-muted/30 data-[state=active]:border-primary/20 data-[state=active]:shadow-none border-2 border-transparent">
                                                <Layers className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">Avanzado</span>
                                                <span className="text-[8px] text-muted-foreground font-medium leading-tight text-center">Wizard Etapas</span>
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </LabeledContainer>

                                <div className="space-y-4">
                                    <FormField<ProductFormValues>
                                        control={form.control}
                                        name="has_bom"
                                        render={({ field }) => {
                                            return (
                                                <LabeledSwitch
                                                    label="Lista de Materiales"
                                                    description={isExpress && !hasVariants ? "Requerido para modo Express." : "Habilitar receta de fabricación."}
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isExpress && !hasVariants}
                                                    icon={<Package className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
                                                    className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
                                                />
                                            )
                                        }}
                                    />

                                    <FormField<ProductFormValues>
                                        control={form.control}
                                        name="has_variants"
                                        render={({ field }) => (
                                            <LabeledSwitch
                                                label="Variantes"
                                                description="Múltiples versiones del mismo producto."
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                icon={<Layers className={cn("h-4 w-4 transition-colors", field.value ? "text-warning" : "text-muted-foreground/30")} />}
                                                className={cn(field.value ? "bg-warning/5 border-warning/20 shadow-sm" : "border-dashed")}
                                            />
                                        )}
                                    />
                                </div>

                                {form.watch("requires_advanced_manufacturing") && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <LabeledSeparator
                                            label="Etapas de Flujo Requeridas"
                                            icon={<Layers className="h-3 w-3" />}
                                        />

                                        <div className="space-y-2">
                                            {[
                                                { name: "mfg_enable_prepress", label: "Pre-Impresión", icon: Monitor },
                                                { name: "mfg_enable_press", label: "Impresión", icon: Printer },
                                                { name: "mfg_enable_postpress", label: "Post-Impresión", icon: Scissors }
                                            ].map((stage) => (
                                                <FormField<ProductFormValues>
                                                    key={stage.name}
                                                    control={form.control}
                                                    name={stage.name as any}
                                                    render={({ field }) => (
                                                        <LabeledSwitch
                                                            label={stage.label}
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            icon={<stage.icon className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
                                                            className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
                                                        />
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className={cn(variantMode ? "md:col-span-12" : "md:col-span-7", "space-y-6")}>
                    {isEditing && (
                        <div className={cn("space-y-4", !(hasBom || variantMode) && "hidden")}>
                            <FormSection title="Gestión de Recetas (BOM)" icon={Layers} />
                            <div className={cn("rounded-2xl overflow-hidden bg-muted/20 border shadow-inner p-1", variantMode && "p-0 border-none bg-transparent shadow-none")}>
                                <div className="bg-card rounded-xl border overflow-hidden">
                                    <BOMManager
                                        product={initialData as any}
                                        variantMode={variantMode}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {!isEditing && (hasBom || variantMode) && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-600">
                            <FormSection title="Gestión de Recetas (BOM)" icon={Layers} />
                            <div className="space-y-4">
                                {bomFields.map((field, index) => (
                                    <BOMItemField
                                        key={field.id}
                                        form={form}
                                        bomIndex={index}
                                        products={products}
                                        uoms={uoms}
                                        onRemove={() => removeBom(index)}
                                        onSetDefault={() => {
                                            bomFields.forEach((_, i) => form.setValue(`boms.${i}.active`, i === index))
                                        }}
                                    />
                                ))}
                                {bomFields.length === 0 && (
                                    <div className="py-20 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-center px-10 bg-muted/5 group hover:border-primary/20 transition-all duration-500">
                                        <div className="p-6 rounded-2xl bg-background border shadow-sm mb-4 group-hover:scale-105 transition-transform duration-500">
                                            <Package className="h-10 w-10 text-primary opacity-40" />
                                        </div>
                                        <h4 className="font-black uppercase tracking-widest text-muted-foreground/80">Receta no Definida</h4>
                                        <p className="text-[10px] text-muted-foreground/50 max-w-xs mt-2 font-medium leading-relaxed italic">
                                            Establezca los materiales y proporciones para automatizar el cálculo de costos y descontar stock.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-6 font-black uppercase text-[10px] h-8 rounded-lg"
                                            onClick={() => appendBom({ name: "Nueva Receta", active: true, lines: [] })}
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-2" /> Crear Primera BOM
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

interface BOMItemFieldProps {
    form: UseFormReturn<ProductFormValues>
    bomIndex: number
    products: Product[]
    uoms: UoM[]
    onRemove: () => void
    onSetDefault: () => void
}

function BOMItemField({ form, bomIndex, products, uoms, onRemove, onSetDefault }: BOMItemFieldProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const { fields: lineFields, append, remove } = useFieldArray({
        control: form.control,
        name: `boms.${bomIndex}.lines`
    })

    const isActive = form.watch(`boms.${bomIndex}.active`)

    return (
        <div className={cn(
            "rounded-md border transition-all duration-200",
            isActive ? "border-primary/50 bg-primary/[0.02]" : "bg-background shadow-sm hover:border-muted-foreground/30"
        )}>
            <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-full transition-colors",
                            isActive ? "bg-primary text-white hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                        )}
                        onClick={onSetDefault}
                    >
                        {isActive ? <Check className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                    </Button>
                    <div className="flex flex-col">
                        <FormField
                            control={form.control}
                            name={`boms.${bomIndex}.name`}
                            render={({ field }) => (
                                <LabeledInput
                                    {...field}
                                    placeholder="Nombre de la receta"
                                    className="h-7 text-xs font-bold bg-transparent border-transparent focus-visible:border-primary/30 w-[200px] px-0"
                                />
                            )}
                        />
                        <span className="text-[10px] text-muted-foreground">
                            {lineFields.length} componentes • {isActive ? 'Predeterminada' : 'Respaldo'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={onRemove}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mt-4 mb-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Componentes de la Receta</h4>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => append({ component: "", quantity: 1, uom: undefined })}
                        >
                            <Plus className="h-3 w-3" /> Añadir
                        </Button>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="h-8 hover:bg-transparent">
                                    <TableHead className="text-[10px] h-8 px-2 font-bold">Componente</TableHead>
                                    <TableHead className="text-[10px] h-8 w-[70px] px-2 font-bold text-center">Cant.</TableHead>
                                    <TableHead className="text-[10px] h-8 w-[80px] px-2 font-bold text-center">Unidad</TableHead>
                                    <TableHead className="text-[10px] h-8 w-[32px] px-2"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lineFields.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4}>
                                            <EmptyState context="production" variant="compact" title="Sin componentes" description="Agregue componentes a esta receta de fabricación." />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lineFields.map((field, index) => (
                                        <TableRow key={field.id} className="h-10 hover:bg-muted/5 border-b last:border-0">
                                            <TableCell className="p-1 px-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase text-primary tracking-tight">AUTOGESTIONADO</span>
                                                    <div className="h-4 w-[1px] bg-border/50" />
                                                </div>
                                                <ProductSelector
                                                    value={form.watch(`boms.${bomIndex}.lines.${index}.component`)}
                                                    onChange={(val) => {
                                                        form.setValue(`boms.${bomIndex}.lines.${index}.component`, val as string)
                                                        const p = products.find((prod) => prod.id?.toString() === val?.toString());
                                                        if (p && p.uom) {
                                                            form.setValue(`boms.${bomIndex}.lines.${index}.uom`, p.uom.toString());
                                                        }
                                                    }}
                                                    placeholder="Sel. componente"
                                                    customFilter={(product: Product) => {
                                                        // No CONSUMABLE - uso interno solamente
                                                        if (product.product_type === 'CONSUMABLE') return false

                                                        // Si es MANUFACTURABLE:
                                                        if (product.product_type === 'MANUFACTURABLE') {
                                                            // Solo mostrar si es express (mfg_auto_finalize: true)
                                                            // Los simples y avanzados no se muestran como componentes según requerimiento
                                                            return !!product.mfg_auto_finalize
                                                        }

                                                        return true
                                                    }} customDisabled={(product: Product) => {
                                                        // Deshabilitar STORABLE sin stock
                                                        if (product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0) {
                                                            return true
                                                        }
                                                        return false
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 px-2">
                                                <FormField
                                                    control={form.control}
                                                    name={`boms.${bomIndex}.lines.${index}.quantity`}
                                                    render={({ field }) => (
                                                        <LabeledInput
                                                            type="number"
                                                            step="0.0001"
                                                            {...field}
                                                            className="h-8 text-center text-[11px] font-mono px-1"
                                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 px-2 text-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`boms.${bomIndex}.lines.${index}.uom`}
                                                    render={({ field }) => {
                                                        const componentId = form.watch(`boms.${bomIndex}.lines.${index}.component`);
                                                        const product = products.find((p) => p.id?.toString() === componentId?.toString()) as Product | undefined;

                                                        // Get UoM IDs, not names
                                                        const uomIds = new Set<string>();
                                                        if (product) {
                                                            if (product.uom) uomIds.add(product.uom.toString());
                                                            if (product.sale_uom) uomIds.add(product.sale_uom.toString());
                                                            if (product.purchase_uom) uomIds.add(product.purchase_uom.toString());
                                                            const allowed_sale_uoms = product.allowed_sale_uoms as (string | { id: number })[] | undefined;
                                                            if (allowed_sale_uoms) {
                                                                allowed_sale_uoms.forEach((uomInfo) => {
                                                                    // Handle both ID and object
                                                                    if (typeof uomInfo === 'object' && uomInfo.id) {
                                                                        uomIds.add(uomInfo.id.toString());
                                                                    } else {
                                                                        uomIds.add(uomInfo.toString());
                                                                    }
                                                                });
                                                            }
                                                        }

                                                        // Filter uoms to only show those related to product's category
                                                        const availableUoms = uoms.filter((u) => uomIds.has(String(u.id)));

                                                        return (
                                                            <UoMSelector
                                                                variant="inline"
                                                                value={field.value ?? ""}
                                                                onChange={field.onChange}
                                                                uoms={uoms}
                                                                product={product as any}
                                                                className="h-8 text-[10px] px-2 w-full justify-between font-normal border rounded-md"
                                                            />
                                                        );
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 px-1 text-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={() => remove(index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    )
}
