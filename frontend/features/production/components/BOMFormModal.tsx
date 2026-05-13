"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useForm, useFieldArray, Resolver, FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form, FormField
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { CancelButton } from "@/components/shared/ActionButtons"
import { Switch } from "@/components/ui/switch"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Trash2, Save, Workflow, Box, CheckCircle2, Truck, Package } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import type { BOM, BOMLine, ProductMinimal, UoM } from "../types"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput, LabeledSelect, LabeledSwitch, FormSection, FormFooter, FormLineItemsTable, IconButton } from "@/components/shared"

const tableInputClass = "h-9 w-full bg-background border border-border/80 rounded-sm px-2 text-xs focus:border-primary/40 focus:outline-none transition-all disabled:opacity-50"

// Schema for material lines (stock components)
const materialLineSchema = z.object({
    component: z.string().min(1, "Componente requerido"),
    component_code: z.string().optional(),
    component_name: z.string().optional(),
    component_cost: z.number().optional(),
    quantity: z.coerce.number().min(1, "Cantidad debe ser mayor a 0"),
    uom: z.string().min(1, "Unidad requerida"),
    uom_name: z.string().optional(),
    component_uom_category: z.number().optional(),
    base_cost: z.number().optional(),
    base_uom: z.string().optional(),
    notes: z.string().optional()
})

// Schema for outsourced service lines
const serviceLineSchema = z.object({
    component: z.string().min(1, "Servicio requerido"),
    component_name: z.string().optional(),
    quantity: z.coerce.number().min(1, "Cantidad debe ser mayor a 0"),
    uom: z.string().optional(),
    uom_name: z.string().optional(),
    supplier: z.string().min(1, "Proveedor requerido"),
    supplier_name: z.string().optional(),
    gross_price: z.coerce.number().min(1, "Monto bruto requerido"),
    document_type: z.string().default("FACTURA"),
    notes: z.string().optional()
})

const bomSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    active: z.boolean().default(true),
    yield_quantity: z.coerce.number().min(0.0001, "El rendimiento debe ser mayor a 0").default(1),
    yield_uom: z.string().min(1, "La unidad de salida es requerida"),
    lines: z.array(materialLineSchema).min(0),
    service_lines: z.array(serviceLineSchema).min(0)
}).refine(data => data.lines.length > 0 || data.service_lines.length > 0, {
    message: "Debe agregar al menos un componente o servicio tercerizado",
    path: ["lines"]
})

type BOMFormValues = z.infer<typeof bomSchema> & FieldValues

interface BOMFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: ProductMinimal
    bomToEdit?: BOM
    onSuccess: () => void
}

export function BOMFormModal({
    open,
    onOpenChange,
    product: initialProduct,
    bomToEdit,
    onSuccess
}: BOMFormModalProps) {
    const [loading, setLoading] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<ProductMinimal | null>(initialProduct || null)
    const [selectedVariant, setSelectedVariant] = useState<ProductMinimal | null>(null)
    const [lineVariantsCache, setLineVariantsCache] = useState<Record<string, ProductMinimal[]>>({})

    const fetchLineVariants = async (productId: string | number, index: number, isService: boolean = false) => {
        if (!productId) return
        try {
            const res = await api.get(`/inventory/products/?parent_template=${productId}&show_technical_variants=true`)
            const vars = res.data.results || res.data
            setLineVariantsCache(prev => ({ ...prev, [productId]: vars }))
        } catch (error) {
            console.error("Error fetching line variants:", error)
        }
    }
    

    const getEffectiveCost = (baseCost: number, productUomId: string | number, targetUomId: string | number) => {
        const productUom = uoms.find(u => u.id.toString() === productUomId.toString())
        const targetUom = uoms.find(u => u.id.toString() === targetUomId.toString())
        
        if (!productUom || !targetUom) return baseCost
        
        const baseRatio = Number(productUom.ratio) || 1
        const targetRatio = Number(targetUom.ratio) || 1
        
        // cost_price is per productUom
        return (baseCost / baseRatio) * targetRatio
    }

    useEffect(() => {
        setSelectedProduct(initialProduct ?? null)
        setSelectedVariant(null)
    }, [initialProduct])

    const { data: uoms = [] } = useQuery({
        queryKey: ['uoms'],
        queryFn: async () => {
            const res = await api.get('/inventory/uoms/')
            return res.data.results || res.data
        }
    })

    const { data: allowedDteTypes = ["FACTURA", "BOLETA"] } = useQuery({
        queryKey: ['accountingSettings'],
        queryFn: async () => {
            const res = await api.get('/accounting/settings/current/')
            return res.data.allowed_dte_types_receive || ["FACTURA", "BOLETA"]
        }
    })

    const { data: variants = [], isLoading: loadingVariants } = useQuery({
        queryKey: ['productVariants', selectedProduct?.id],
        queryFn: async () => {
            const res = await api.get(`/inventory/products/?parent_template=${selectedProduct?.id}&show_technical_variants=true`)
            return res.data.results || res.data
        },
        enabled: !!selectedProduct?.id && !!selectedProduct?.has_variants
    })

    useEffect(() => {
        if (variants.length > 0 && bomToEdit?.product) {
            const activeVariant = variants.find((v: ProductMinimal) => v.id.toString() === bomToEdit.product?.toString())
            if (activeVariant) {
                setSelectedVariant(activeVariant)
            }
        } else if (!bomToEdit) {
            setSelectedVariant(null)
        }
    }, [variants, bomToEdit])

    const form = useForm<BOMFormValues>({
        resolver: zodResolver(bomSchema) as any,
        defaultValues: {
            name: "",
            active: true,
            yield_quantity: 1,
            yield_uom: "",
            lines: [],
            service_lines: []
        }
    })

    const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({
        control: form.control,
        name: "lines"
    })

    const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
        control: form.control,
        name: "service_lines"
    })

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    // Reset form when dialog opens/closes or bomToEdit changes
    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = bomToEdit?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            if (bomToEdit) {
                const allLines: BOMLine[] = bomToEdit.lines || []
                const stockLines = allLines.filter((l: BOMLine) => !l.is_outsourced)
                const outsourcedLines = allLines.filter((l: BOMLine) => l.is_outsourced)

                form.reset({
                    name: bomToEdit.name,
                    active: bomToEdit.active,
                    yield_quantity: bomToEdit.yield_quantity || 1,
                    yield_uom: bomToEdit.yield_uom?.toString() || "",
                    lines: stockLines.map((l: BOMLine) => ({
                        component: l.component.toString(),
                        component_code: l.component_code,
                        component_name: l.component_name,
                        component_cost: l.component_cost || 0,
                        base_cost: l.component_cost || 0, // Fallback
                        base_uom: l.uom?.toString() || "", // Fallback
                        quantity: l.quantity,
                        uom: l.uom?.toString() || "",
                        uom_name: l.uom_name || "",
                        component_uom_category: l.uom_category,
                        notes: l.notes || ""
                    })),
                    service_lines: outsourcedLines.map((l: BOMLine) => ({
                        component: l.component.toString(),
                        component_name: l.component_name,
                        quantity: l.quantity,
                        uom: l.uom?.toString() || "",
                        uom_name: l.uom_name || "",
                        supplier: l.supplier?.toString() || "",
                        supplier_name: l.supplier_name || "",
                        gross_price: l.unit_price ? parseFloat(l.unit_price) * 1.19 : 0,
                        document_type: l.document_type || "FACTURA",
                        notes: l.notes || ""
                    }))
                })
            } else {
                form.reset({
                    name: "Nueva Lista de Materiales",
                    active: true,
                    yield_quantity: 1,
                    yield_uom: "",
                    lines: [],
                    service_lines: []
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, bomToEdit, form])

    const onSubmit = async (data: BOMFormValues) => {
        if (!selectedProduct) {
            toast.error("Debe seleccionar un producto")
            return
        }

        if (selectedProduct.has_variants && !selectedVariant) {
            toast.error("Debe seleccionar una variante específica para asignar la Lista de Materiales")
            return
        }

        setLoading(true)
        try {
            const targetProductId = selectedVariant?.id || selectedProduct.id || selectedProduct

            // Merge material lines and service lines into a single array for the backend
            const materialPayloadLines = data.lines.map(l => ({
                component: parseInt(l.component),
                quantity: l.quantity,
                uom: l.uom ? parseInt(l.uom) : null,
                is_outsourced: false,
                notes: l.notes
            }))

            const servicePayloadLines = data.service_lines.map(l => ({
                component: parseInt(l.component),
                quantity: l.quantity,
                uom: l.uom ? parseInt(l.uom) : null,
                is_outsourced: true,
                supplier: parseInt(l.supplier),
                unit_price: Math.round(l.gross_price / 1.19),
                document_type: l.document_type,
                notes: l.notes
            }))

            const payload = {
                product: targetProductId,
                name: data.name,
                active: data.active,
                yield_quantity: data.yield_quantity,
                yield_uom: data.yield_uom ? parseInt(data.yield_uom) : null,
                lines: [...materialPayloadLines, ...servicePayloadLines]
            }

            if (bomToEdit && bomToEdit.id) {
                await api.patch(`/production/boms/${bomToEdit.id}/`, payload)
                toast.success("Lista de Materiales actualizada correctamente")
            } else {
                await api.post("/production/boms/", payload)
                toast.success("Lista de Materiales creada correctamente")
            }
            if (onSuccess) onSuccess()

            setTimeout(() => {
                onOpenChange(false)
            }, 100)
        } catch (error: unknown) {
            console.error("Error saving BOM:", error)
            showApiError(error, "Error al guardar Lista de Materiales: ")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            className="max-w-[1200px]"
            title={
                <div className="flex items-center gap-3">
                    <Workflow className="h-5 w-5" />
                    <span className="font-bold tracking-tight">
                        {bomToEdit ? "Editar Lista de Materiales" : "Nueva Lista de Materiales"}
                    </span>
                </div>
            }
            description={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    <span>Lista de Materiales</span>
                    <span className="opacity-30">|</span>
                    {selectedVariant ? (
                        <span className="text-foreground">V: {selectedVariant.variant_display_name || selectedVariant.name}</span>
                    ) : selectedProduct ? (
                        <span className="text-foreground">P: {selectedProduct.name}</span>
                    ) : (
                        <span>Receta de Fabricación</span>
                    )}
                </div>
            }
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                form="bom-form"
                                type="submit"
                                loading={form.formState.isSubmitting}
                                icon={Save}
                                disabled={form.formState.isSubmitting}
                            >
                                {bomToEdit ? "Guardar Cambios" : "Crear Receta"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <div className="px-1">
                <Form {...form}>
                    <form id="bom-form" 
                        onSubmit={form.handleSubmit(onSubmit as any, (errors) => {
                            console.log("Validation errors:", errors)
                            toast.error("Por favor, verifique los campos marcados en rojo")
                        })} 
                        className="space-y-8 pt-4"
                    >
                        {/* 📋 HEADER: IDENTIFICACIÓN Y CONFIGURACIÓN */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start border-b border-border/40 pb-8 mb-2">
                            {/* FILA 1 */}
                            <div className="md:col-span-1">
                                <FormField
                                    control={form.control as any}
                                    name="active"
                                    render={({ field }) => (
                                        <LabeledSwitch
                                            label="Receta Activa"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            description={field.value ? "Lista Principal" : "Lista de Respaldo"}
                                            icon={field.value ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Workflow className="h-4 w-4 text-muted-foreground/30" />}
                                            className={cn(
                                                "transition-all",
                                                field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed"
                                            )}
                                        />
                                    )}
                                />
                            </div>

                            <div className="md:col-span-1 invisible md:visible" />

                            <div className="md:col-span-2">
                                <FormField
                                    control={form.control as any}
                                    name="name"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Nombre de la Receta"
                                            required
                                            placeholder="Ej: Versión Estándar 2024"
                                            error={fieldState.error?.message}
                                            {...field}
                                        />
                                    )}
                                />
                            </div>

                            {/* FILA 2 */}
                            <div className="md:col-span-2">
                                {!initialProduct ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className={cn(selectedProduct?.has_variants ? "sm:col-span-1" : "sm:col-span-2")}>
                                            <ProductSelector
                                                label="Producto a fabricar"
                                                required
                                                value={selectedProduct?.id}
                                                onSelect={(p) => setSelectedProduct(p)}
                                                onChange={(val) => {
                                                    if (!val) setSelectedProduct(null)
                                                }}
                                                placeholder="Seleccionar producto..."
                                                allowedTypes={['MANUFACTURABLE']}
                                                shouldResolveVariants={false}
                                            />
                                        </div>

                                        {selectedProduct?.has_variants && (
                                            <div className="sm:col-span-1 animate-in fade-in slide-in-from-left-2">
                                                <LabeledSelect
                                                    label="Variante"
                                                    required
                                                    placeholder="Variante..."
                                                    value={selectedVariant?.id?.toString() || ""}
                                                    onChange={(val) => {
                                                        const v = variants.find(varnt => varnt.id.toString() === val)
                                                        setSelectedVariant(v || null)
                                                    }}
                                                    disabled={!!bomToEdit || loadingVariants}
                                                    options={variants.map(v => ({
                                                        value: v.id.toString(),
                                                        label: `${v.variant_display_name || v.name} (${v.internal_code || v.code})`
                                                    }))}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-primary/[0.02] p-2 rounded-md border border-primary/10 h-[2.5rem]">
                                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Box className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-0.5">Producto</span>
                                            <span className="text-[10px] font-black text-foreground truncate uppercase">
                                                {selectedVariant ? (selectedVariant.variant_display_name || selectedVariant.name) : (selectedProduct?.name || "")}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-1">
                                <FormField
                                    control={form.control as any}
                                    name="yield_uom"
                                    render={({ field, fieldState }) => (
                                        <UoMSelector
                                            label="Unidad de Salida"
                                            required
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            categoryId={selectedProduct?.uom_category}
                                            uoms={uoms}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                            </div>

                            <div className="md:col-span-1">
                                <FormField
                                    control={form.control as any}
                                    name="yield_quantity"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Rendimiento"
                                            required
                                            type="number"
                                            min="0.0001"
                                            step="any"
                                            placeholder="1"
                                            error={fieldState.error?.message}
                                            {...field}
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* SECTION 1: MATERIAS PRIMAS Y COMPONENTES (Stock Materials) */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <FormLineItemsTable
                            icon={Package}
                            title="Materias Primas y Componentes"
                            subtitle={`${materialFields.length} ítem(s) definido(s) en la receta`}
                            columns={[
                                { header: "Componente", width: "w-[35%]" },
                                { header: "Cantidad", width: "w-[10%]" },
                                { header: "Unidad", width: "w-[15%]" },
                                { header: "Costo unit.", width: "w-[15%]", align: "right" },
                                { header: "Costo Total", width: "w-[15%]", align: "right" },
                                { header: "", width: "w-[10%]" },
                            ]}
                            onAdd={() => appendMaterial({ component: "", quantity: 1, uom: "", component_cost: 0, notes: "" })}
                            addButtonText="Agregar Línea"
                            footer={(() => {
                                const materials = form.watch("lines") || []
                                const totalUnitCost = materials.reduce((sum: number, m: any) => sum + (Number(m.component_cost) || 0), 0)
                                const totalLineCost = materials.reduce((sum: number, m: any) => sum + ((Number(m.quantity) || 0) * (Number(m.component_cost) || 0)), 0)
                                return (
                                    <div className="flex flex-col items-end text-[10px] font-black uppercase text-foreground/80 pr-12 gap-1">
                                        <div className="flex gap-4">
                                            <span className="text-muted-foreground">Total Unitarios:</span>
                                            <span className="text-primary">{formatCurrency(totalUnitCost)}</span>
                                        </div>
                                        <div className="flex gap-4 pt-1">
                                            <span className="text-muted-foreground">Total Receta:</span>
                                            <span className="text-primary">{formatCurrency(totalLineCost)}</span>
                                        </div>
                                    </div>
                                )
                            })()}
                        >
                            <TableBody>
                                {materialFields.map((field, index) => (
                                    <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
                                        {/* Componente + variante */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`lines.${index}.component`}
                                                render={({ field: propField, fieldState }) => {
                                                    const compId = form.watch(`lines.${index}.component`)
                                                    const lineVars = lineVariantsCache[compId] || []
                                                    const hasVars = lineVars.length > 0

                                                    if (!hasVars) {
                                                        return (
                                                            <ProductSelector
                                                                value={propField.value}
                                                                onSelect={(p) => {
                                                                    propField.onChange(p.id.toString())
                                                                    form.setValue(`lines.${index}.component_name`, p.name)
                                                                    form.setValue(`lines.${index}.component_code`, p.internal_code || p.code)
                                                                    const baseCost = Number(p.cost_price || 0)
                                                                    const baseUomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom?.toString() || ""
                                                                    
                                                                    form.setValue(`lines.${index}.base_cost`, baseCost)
                                                                    form.setValue(`lines.${index}.base_uom`, baseUomId)
                                                                    
                                                                    if (p.uom) {
                                                                        const uomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()
                                                                        form.setValue(`lines.${index}.uom`, uomId)
                                                                        form.setValue(`lines.${index}.uom_name`, p.uom_name || (typeof p.uom === 'object' ? p.uom.name : ""))
                                                                        
                                                                        const effectiveCost = getEffectiveCost(baseCost, baseUomId, uomId)
                                                                        form.setValue(`lines.${index}.component_cost`, effectiveCost)
                                                                    } else {
                                                                        form.setValue(`lines.${index}.component_cost`, baseCost)
                                                                    }
                                                                    
                                                                    if (p.uom_category) form.setValue(`lines.${index}.component_uom_category`, p.uom_category)
                                                                    if (p.has_variants) fetchLineVariants(p.id, index)
                                                                }}
                                                                onChange={(val) => propField.onChange(val)}
                                                                placeholder="Buscar componente..."
                                                                allowedTypes={['STORABLE', 'MANUFACTURABLE']}
                                                                customFilter={(p: ProductMinimal) =>
                                                                    !!(p.product_type === 'STORABLE' ||
                                                                        (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing))
                                                                }
                                                                excludeIds={selectedProduct ? [selectedProduct.id] : []}
                                                                shouldResolveVariants={false}
                                                                variant="inline"
                                                                className={cn(tableInputClass, "w-full text-left font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                            />
                                                        )
                                                    }

                                                    return (
                                                        <div className="flex items-center gap-1">
                                                            <ProductSelector
                                                                value={propField.value}
                                                                onSelect={(p) => {
                                                                    propField.onChange(p.id.toString())
                                                                    form.setValue(`lines.${index}.component_name`, p.name)
                                                                    form.setValue(`lines.${index}.component_code`, p.internal_code || p.code)
                                                                    const baseCost = Number(p.cost_price || 0)
                                                                    const baseUomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom?.toString() || ""
                                                                    
                                                                    form.setValue(`lines.${index}.base_cost`, baseCost)
                                                                    form.setValue(`lines.${index}.base_uom`, baseUomId)
                                                                    
                                                                    if (p.uom) {
                                                                        const uomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()
                                                                        form.setValue(`lines.${index}.uom`, uomId)
                                                                        form.setValue(`lines.${index}.uom_name`, p.uom_name || (typeof p.uom === 'object' ? p.uom.name : ""))
                                                                        
                                                                        const effectiveCost = getEffectiveCost(baseCost, baseUomId, uomId)
                                                                        form.setValue(`lines.${index}.component_cost`, effectiveCost)
                                                                    } else {
                                                                        form.setValue(`lines.${index}.component_cost`, baseCost)
                                                                    }
                                                                    
                                                                    if (p.uom_category) form.setValue(`lines.${index}.component_uom_category`, p.uom_category)
                                                                    if (p.has_variants) fetchLineVariants(p.id, index)
                                                                }}
                                                                onChange={(val) => propField.onChange(val)}
                                                                placeholder="Buscar..."
                                                                allowedTypes={['STORABLE', 'MANUFACTURABLE']}
                                                                customFilter={(p: ProductMinimal) =>
                                                                    !!(p.product_type === 'STORABLE' ||
                                                                        (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing))
                                                                }
                                                                excludeIds={selectedProduct ? [selectedProduct.id] : []}
                                                                shouldResolveVariants={false}
                                                                variant="inline"
                                                                className={cn(tableInputClass, "flex-1 text-left font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                            />
                                                            <LabeledSelect
                                                                value={form.watch(`lines.${index}.component`)}
                                                                onChange={(val) => {
                                                                    form.setValue(`lines.${index}.component`, val)
                                                                    const v = lineVars.find((vr: { id: string | number }) => vr.id.toString() === val)
                                                                    if (v) {
                                                                        form.setValue(`lines.${index}.component_name`, v.variant_display_name || v.name)
                                                                        form.setValue(`lines.${index}.component_code`, v.internal_code || v.code)
                                                                        
                                                                        const baseCost = Number(v.cost_price || 0)
                                                                        const baseUomId = typeof v.uom === 'object' ? (v.uom as UoM).id.toString() : v.uom?.toString() || ""
                                                                        
                                                                        form.setValue(`lines.${index}.base_cost`, baseCost)
                                                                        form.setValue(`lines.${index}.base_uom`, baseUomId)
                                                                        
                                                                        if (v.uom_category) form.setValue(`lines.${index}.component_uom_category`, p.uom_category)
                                                                        
                                                                        const currentLineUom = form.getValues(`lines.${index}.uom`)
                                                                        const effectiveCost = getEffectiveCost(baseCost, baseUomId, currentLineUom)
                                                                        form.setValue(`lines.${index}.component_cost`, effectiveCost)
                                                                    }
                                                                }}
                                                                placeholder="V..."
                                                                variant="inline"
                                                                className={cn(tableInputClass, "w-[40px] bg-primary/5")}
                                                                options={lineVars.map(v => ({ value: v.id.toString(), label: v.variant_display_name || v.name }))}
                                                            />
                                                        </div>
                                                    )
                                                }}
                                            />
                                        </TableCell>
 
                                        {/* Cantidad */}
                                        <TableCell className="py-2 px-3 text-center">
                                            <FormField
                                                control={form.control as any}
                                                name={`lines.${index}.quantity`}
                                                render={({ field, fieldState }) => (
                                                    <input type="number" step="1" {...field} className={cn(tableInputClass, "text-center font-bold", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")} />
                                                )}
                                            />
                                        </TableCell>
 
                                        {/* Unidad */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`lines.${index}.uom`}
                                                render={({ field, fieldState }) => {
                                                    const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1
                                                    return (
                                                        <UoMSelector
                                                            context="bom"
                                                            categoryId={Number(form.watch(`lines.${index}.component_uom_category`)) || undefined}
                                                            value={field.value || ""}
                                                            onChange={(val) => {
                                                                field.onChange(val)
                                                                const selectedUom = uoms.find((u: { id: string | number }) => u.id.toString() === val)
                                                                if (selectedUom) {
                                                                    form.setValue(`lines.${index}.uom_name`, selectedUom.name)
                                                                    
                                                                    // RE-CALCULATE COST BASED ON NEW UOM
                                                                    const baseCost = form.getValues(`lines.${index}.base_cost`) || 0
                                                                    const baseUomId = form.getValues(`lines.${index}.base_uom`) || ""
                                                                    
                                                                    if (baseUomId) {
                                                                        const effectiveCost = getEffectiveCost(baseCost, baseUomId, val)
                                                                        form.setValue(`lines.${index}.component_cost`, effectiveCost)
                                                                    }
                                                                }
                                                            }}
                                                            uoms={uoms}
                                                            variant="inline"
                                                            showConversionHint={false}
                                                            quantity={quantity}
                                                            label=""
                                                            className={cn(tableInputClass, "font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                        />
                                                    )
                                                }}
                                            />
                                        </TableCell>

                                        {/* Costo Est. */}
                                        <TableCell className="py-1 px-3">
                                            <div className="text-[10px] font-medium font-mono text-right text-muted-foreground pr-1">
                                                {formatCurrency(form.watch(`lines.${index}.component_cost`) || 0)}
                                            </div>
                                        </TableCell>

                                        {/* Costo Total */}
                                        <TableCell className="py-1 px-3">
                                            <div className="text-[10px] font-bold font-mono text-right text-primary pr-1">
                                                {formatCurrency((Number(form.watch(`lines.${index}.quantity`)) || 0) * (Number(form.watch(`lines.${index}.component_cost`)) || 0))}
                                            </div>
                                        </TableCell>

                                        {/* Eliminar */}
                                        <TableCell className="py-2 px-3 text-center">
                                            <IconButton
                                                onClick={() => removeMaterial(index)}
                                                className="h-8 w-8 text-muted-foreground/30 hover:text-destructive"
                                                title="Eliminar línea"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </FormLineItemsTable>

                        {form.formState.errors.lines && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive mt-2">
                                {(form.formState.errors.lines as any).root?.message
                                    ? (form.formState.errors.lines as any).root.message
                                    : `Hay errores en ${Object.keys(form.formState.errors.lines).length} componente(s). Verifique los campos en rojo.`
                                }
                            </div>
                        )}


                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* SECTION 2: SERVICIOS TERCERIZADOS (Outsourced Services) */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <FormLineItemsTable
                            icon={Truck}
                            title="Servicios Tercerizados"
                            subtitle={`${serviceFields.length} servicio(s) · Se pre-llenan en la OT al fabricar`}
                            columns={[
                                { header: "Servicio", width: "w-[22%]" },
                                { header: "Proveedor", width: "w-[22%]" },
                                { header: "Cantidad", width: "w-[8%]" },
                                { header: "Unidad", width: "w-[14%]" },
                                { header: "Bruto Unit.", width: "w-[14%]", align: "right", className: "text-primary" },
                                { header: "Doc.", width: "w-[10%]" },
                                { header: "", width: "w-[10%]" },
                            ]}
                            onAdd={() => appendService({
                                component: "", quantity: 1, uom: "",
                                supplier: "", supplier_name: "",
                                gross_price: 0, document_type: "FACTURA", notes: ""
                            })}
                            addButtonText="Agregar Servicio"
                            footer={(() => {
                                const services = form.watch("service_lines") || []
                                const totalGrossPrice = services.reduce((sum: number, s: any) => sum + (Number(s.gross_price) || 0), 0)
                                return (
                                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-foreground/80 pr-24">
                                        <span className="text-muted-foreground">Total Bruto Unit.:</span>
                                        <span className="text-primary">{formatCurrency(totalGrossPrice)}</span>
                                    </div>
                                )
                            })()}
                        >
                            <TableBody>
                                {serviceFields.map((field, index) => (
                                    <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
                                        {/* Servicio */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`service_lines.${index}.component`}
                                                render={({ field: propField, fieldState }) => {
                                                    const compId = form.watch(`service_lines.${index}.component`)
                                                    const lineVars = lineVariantsCache[compId] || []
                                                    const hasVars = lineVars.length > 0

                                                    if (!hasVars) {
                                                        return (
                                                            <ProductSelector
                                                                value={propField.value}
                                                                onSelect={(p) => {
                                                                    propField.onChange(p.id.toString())
                                                                    form.setValue(`service_lines.${index}.component_name`, p.name)
                                                                    if (p.uom) {
                                                                        const uomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()
                                                                        form.setValue(`service_lines.${index}.uom`, uomId)
                                                                    }
                                                                    if (p.has_variants) fetchLineVariants(p.id, index, true)
                                                                }}
                                                                onChange={(val) => propField.onChange(val)}
                                                                placeholder="Buscar servicio..."
                                                                shouldResolveVariants={false}
                                                                variant="inline"
                                                                customFilter={(p: ProductMinimal & { product_type?: string, can_be_purchased?: boolean }) => !!(p.product_type === 'SERVICE' && p.can_be_purchased)}
                                                                className={cn(tableInputClass, "w-full text-left font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                            />
                                                        )
                                                    }

                                                    return (
                                                        <div className="flex items-center gap-1">
                                                            <ProductSelector
                                                                value={propField.value}
                                                                onSelect={(p) => {
                                                                    propField.onChange(p.id.toString())
                                                                    form.setValue(`service_lines.${index}.component_name`, p.name)
                                                                    if (p.uom) {
                                                                        const uomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()
                                                                        form.setValue(`service_lines.${index}.uom`, uomId)
                                                                    }
                                                                    if (p.has_variants) fetchLineVariants(p.id, index, true)
                                                                }}
                                                                onChange={(val) => propField.onChange(val)}
                                                                placeholder="Buscar..."
                                                                shouldResolveVariants={false}
                                                                variant="inline"
                                                                customFilter={(p: ProductMinimal & { product_type?: string, can_be_purchased?: boolean }) => !!(p.product_type === 'SERVICE' && p.can_be_purchased)}
                                                                className={cn(tableInputClass, "flex-1 text-left font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                            />
                                                            <LabeledSelect
                                                                variant="inline"
                                                                value={form.watch(`service_lines.${index}.component`)}
                                                                onChange={(val) => {
                                                                    form.setValue(`service_lines.${index}.component`, val)
                                                                    const v = lineVars.find((vr: { id: string | number }) => vr.id.toString() === val)
                                                                    if (v) {
                                                                        form.setValue(`service_lines.${index}.component_name`, v.variant_display_name || v.name)
                                                                        if (v.uom_category) form.setValue(`service_lines.${index}.component_uom_category`, v.uom_category)
                                                                    }
                                                                }}
                                                                placeholder="V..."
                                                                className={cn(tableInputClass, "w-[40px] bg-primary/5")}
                                                                options={lineVars.map(v => ({ value: v.id.toString(), label: v.variant_display_name || v.name }))}
                                                            />
                                                        </div>
                                                    )
                                                }}
                                            />
                                        </TableCell>

                                        {/* Proveedor */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`service_lines.${index}.supplier`}
                                                render={({ field, fieldState }) => (
                                                    <AdvancedContactSelector
                                                        value={field.value}
                                                        onChange={(val, contact) => {
                                                            field.onChange(val)
                                                            if (contact) form.setValue(`service_lines.${index}.supplier_name`, contact.name)
                                                        }}
                                                        placeholder="Proveedor..."
                                                        allowedTypes={['SUPPLIER']}
                                                        variant="inline"
                                                        className={cn(tableInputClass, "text-left font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                    />
                                                )}
                                            />
                                        </TableCell>

                                        {/* Cantidad */}
                                        <TableCell className="py-2 px-3 text-center">
                                            <FormField
                                                control={form.control as any}
                                                name={`service_lines.${index}.quantity`}
                                                render={({ field, fieldState }) => (
                                                    <input type="number" step="1" {...field} className={cn(tableInputClass, "text-center font-bold", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")} />
                                                )}
                                            />
                                        </TableCell>

                                        {/* Unidad */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`service_lines.${index}.uom`}
                                                render={({ field, fieldState }) => (
                                                    <UoMSelector
                                                        value={field.value || ""}
                                                        onChange={(val) => {
                                                            field.onChange(val)
                                                            const selectedUom = uoms.find((u: { id: string | number }) => u.id.toString() === val)
                                                            if (selectedUom) form.setValue(`service_lines.${index}.uom_name`, selectedUom.name)
                                                        }}
                                                        uoms={uoms}
                                                        variant="inline"
                                                        showConversionHint={false}
                                                        label=""
                                                        className={cn(tableInputClass, "font-normal", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                    />
                                                )}
                                            />
                                        </TableCell>

                                        {/* Bruto Unit. */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`service_lines.${index}.gross_price`}
                                                render={({ field, fieldState }) => (
                                                    <input
                                                        type="number"
                                                        {...field}
                                                        onFocus={e => e.target.select()}
                                                        className={cn(tableInputClass, "text-right font-mono font-bold text-primary", fieldState.error && "border-destructive/50 ring-1 ring-destructive/10")}
                                                    />
                                                )}
                                            />
                                        </TableCell>

                                        {/* Doc. */}
                                        <TableCell className="py-1 px-3">
                                            <FormField
                                                control={form.control as any}
                                                name={`service_lines.${index}.document_type`}
                                                render={({ field }) => (
                                                    <LabeledSelect
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        variant="inline"
                                                        className={tableInputClass}
                                                        options={allowedDteTypes.map(t => ({ value: t, label: t }))}
                                                    />
                                                )}
                                            />
                                        </TableCell>

                                        {/* Eliminar */}
                                        <TableCell className="py-2 px-3 text-center">
                                            <IconButton
                                                onClick={() => removeService(index)}
                                                className="h-8 w-8 text-muted-foreground/30 hover:text-destructive"
                                                title="Eliminar servicio"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </FormLineItemsTable>


                    </form>
                </Form>
            </div>
        </BaseModal>
    )
}
