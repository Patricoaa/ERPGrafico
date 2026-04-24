"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm, useFieldArray, Resolver, FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form, FormField
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CancelButton } from "@/components/shared/ActionButtons"
import { Switch } from "@/components/ui/switch"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Save, Workflow, Box, CheckCircle2, Truck, Package } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import type { BOM, BOMLine, ProductMinimal, UoM } from "../types"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput, LabeledSelect } from "@/components/shared";

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
    yield_uom: z.string().optional(),
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
    const [variants, setVariants] = useState<ProductMinimal[]>([])
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
    const [loadingVariants, setLoadingVariants] = useState(false)
    const [uoms, setUoms] = useState<UoM[]>([])

    useEffect(() => {
        setSelectedProduct(initialProduct ?? null)
        setSelectedVariant(null)
        setVariants([])
    }, [initialProduct])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const uRes = await api.get('/inventory/uoms/')
                setUoms(uRes.data.results || uRes.data)
            } catch (error) {
                console.error("Error fetching dependencies for BOMForm:", error)
            }
        }
        fetchData()
    }, [])

    // Fetch variants when product has_variants is true
    useEffect(() => {
        let isMounted = true
        const fetchVariants = async () => {
            if (!selectedProduct?.id || !selectedProduct?.has_variants) {
                if (isMounted) {
                    setVariants([])
                    if (!bomToEdit) setSelectedVariant(null)
                }
                return
            }

            if (isMounted) setLoadingVariants(true)
            try {
                const res = await api.get(`/inventory/products/?parent_template=${selectedProduct.id}&show_technical_variants=true`)
                const loadedVariants = res.data.results || res.data
                if (isMounted) {
                    setVariants(loadedVariants)

                    if (bomToEdit && bomToEdit.product) {
                        const activeVariant = loadedVariants.find((v: ProductMinimal) => v.id.toString() === bomToEdit.product?.toString())
                        if (activeVariant) {
                            setSelectedVariant(activeVariant ?? null)
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching variants:", error)
                if (isMounted) toast.error("Error al cargar variantes")
            } finally {
                if (isMounted) setLoadingVariants(false)
            }
        }
        fetchVariants()
        return () => { isMounted = false }
    }, [selectedProduct?.id, bomToEdit?.id])

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

    // Reset form when dialog opens/closes or bomToEdit changes
    useEffect(() => {
        if (open) {
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
                        quantity: l.quantity,
                        uom: l.uom?.toString() || "",
                        uom_name: l.uom_name || "",
                        component_uom_category: l.uom_category, // Assuming backend provides this
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
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Lista de Materiales</span>
                    <span className="opacity-30">|</span>
                    {selectedVariant ? (
                        <span>Variante: {selectedVariant.variant_display_name || selectedVariant.name}</span>
                    ) : selectedProduct ? (
                        <span>Producto: {selectedProduct.name}</span>
                    ) : (
                        <span>Receta de Fabricación</span>
                    )}
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full px-6 py-4 border-t border-border/40">
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <ActionSlideButton
                        form="bom-form"
                        type="submit"
                        loading={form.formState.isSubmitting}
                        icon={Save}
                        disabled={form.formState.isSubmitting}
                        className="rounded-md text-xs font-bold"
                    >
                        {bomToEdit ? "Guardar Cambios" : "Crear Receta"}
                    </ActionSlideButton>
                </div>
            }
        >
            {!initialProduct ? (
                <div className="mb-6 pb-6 border-b border-border/40">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                        <div className={cn(selectedProduct?.has_variants ? "md:col-span-7" : "md:col-span-12")}>
                            <ProductSelector
                                label="Producto a fabricar"
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
                            <div className="md:col-span-5 animate-in fade-in slide-in-from-left-2 duration-300">
                                <LabeledSelect
                                    label="Variante del producto"
                                    placeholder="Seleccione variante..."
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
                                    hint={variants.length === 0 && !loadingVariants ? "No se encontraron variantes disponibles" : undefined}
                                />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mb-6 pb-4 border-b border-border/40 flex items-center justify-between bg-primary/[0.02] p-4 rounded-lg border border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Box className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Producto en Edición</span>
                            <span className="text-sm font-black text-foreground">
                                {selectedVariant ? (selectedVariant.variant_display_name || selectedVariant.name) : (selectedProduct?.name || "")}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-sm">
                            Modo Lectura
                        </span>
                        {selectedVariant?.internal_code && (
                            <span className="text-[10px] font-mono text-muted-foreground mt-1">{selectedVariant.internal_code}</span>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-1">
                <Form {...form}>
                    <form id="bom-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {/* COLUMNA IZQUIERDA: IDENTIFICACIÓN */}
                            <div className="space-y-3">
                                <FormField
                                    control={form.control as any}
                                    name="name"
                                    render={({ field, fieldState }) => (
                                        <div className="space-y-1">
                                            <LabeledInput
                                                label="Nombre de la Receta"
                                                placeholder="Ej: Versión Estándar 2024"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        </div>
                                    )}
                                />

                                <FormField
                                    control={form.control as any}
                                    name="active"
                                    render={({ field }) => (
                                        <div className={cn(
                                            "flex items-center gap-3 p-2 rounded-md border transition-all duration-200 shadow-sm",
                                            field.value ? "bg-primary/[0.03] border-primary/20 ring-1 ring-primary/5" : "bg-muted/[0.03] border-border/60"
                                        )}>
                                            <div className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-md border transition-colors shadow-sm",
                                                field.value ? "bg-primary/10 border-primary/20 text-primary" : "bg-background border-border text-muted-foreground/50"
                                            )}>
                                                {field.value ? (
                                                    <CheckCircle2 className="h-4 w-4" />
                                                ) : (
                                                    <Workflow className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-0">
                                                <span className={cn("text-[10px] font-black uppercase tracking-widest cursor-pointer block",
                                                    field.value ? "text-primary" : "text-muted-foreground/60"
                                                )}>RECETA ACTIVA</span>
                                                <div className={cn(
                                                    "text-[9px] font-bold uppercase tracking-tight",
                                                    field.value ? "text-primary/60" : "text-muted-foreground/40"
                                                )}>
                                                    {field.value ? "Lista Principal" : "Lista de Respaldo"}
                                                </div>
                                            </div>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={cn(field.value && "data-[state=checked]:bg-primary scale-75")}
                                            />
                                        </div>
                                    )}
                                />
                            </div>

                            {/* COLUMNA DERECHA: RENDIMIENTO */}
                            <div className="space-y-3">
                                <FormField
                                    control={form.control as any}
                                    name="yield_quantity"
                                    render={({ field, fieldState }) => (
                                        <div className="space-y-1">
                                            <LabeledInput
                                                label="Rendimiento / Producción"
                                                type="number"
                                                min="0.0001"
                                                step="any"
                                                placeholder="1"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        </div>
                                    )}
                                />

                                <FormField
                                    control={form.control as any}
                                    name="yield_uom"
                                    render={({ field, fieldState }) => (
                                        <UoMSelector
                                            label="Unidad de Salida"
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            categoryId={selectedProduct?.uom_category}
                                            uoms={uoms}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* SECTION 1: MATERIAS PRIMAS Y COMPONENTES (Stock Materials) */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <div className="flex items-center gap-2 pt-2 pb-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lista de Componentes</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">
                                            Materias Primas y Componentes
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight opacity-70">
                                            {materialFields.length} ítems definidos en la receta
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => appendMaterial({ component: "", quantity: 1, uom: "", component_cost: 0, notes: "" })}
                                    className="gap-2 rounded-lg h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar Línea
                                </Button>
                            </div>

                            {materialFields.length > 0 && (
                                <div className="border rounded-lg overflow-hidden shadow-sm bg-white/50 backdrop-blur-sm border-border/60">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                                                <TableHead className="w-[43%] text-[10px] font-black uppercase tracking-widest py-4">Componente</TableHead>
                                                <TableHead className="w-[15%] text-[10px] font-black uppercase tracking-widest py-4">Cantidad</TableHead>
                                                <TableHead className="w-[15%] text-[10px] font-black uppercase tracking-widest py-4">Unidad</TableHead>
                                                <TableHead className="w-[15%] text-right text-[10px] font-black uppercase tracking-widest py-4 text-primary">Costo Est.</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {materialFields.map((field, index) => (
                                                <TableRow key={field.id} className="hover:bg-muted/10 transition-colors">
                                                    <TableCell className="py-2">
                                                        <div className="space-y-1">
                                                            <FormField
                                                                control={form.control as any}
                                                                name={`lines.${index}.component`}
                                                                render={({ field: propField }) => (
                                                                    <ProductSelector
                                                                        value={propField.value}
                                                                        onSelect={(p) => {
                                                                            propField.onChange(p.id.toString())
                                                                            form.setValue(`lines.${index}.component_name`, p.name)
                                                                            form.setValue(`lines.${index}.component_code`, p.internal_code || p.code)
                                                                            form.setValue(`lines.${index}.component_cost`, Number(p.cost_price || 0))

                                                                            if (p.uom) {
                                                                                const uomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()
                                                                                form.setValue(`lines.${index}.uom`, uomId)
                                                                                form.setValue(`lines.${index}.uom_name`, p.uom_name || (typeof p.uom === 'object' ? p.uom.name : ""))
                                                                            }
                                                                            if (p.uom_category) {
                                                                                form.setValue(`lines.${index}.component_uom_category`, p.uom_category)
                                                                            }

                                                                            if (p.has_variants) {
                                                                                fetchLineVariants(p.id, index)
                                                                            }
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
                                                                        className="h-8 text-xs border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent"
                                                                    />
                                                                )}
                                                            />

                                                            {(() => {
                                                                const compId = form.watch(`lines.${index}.component`)
                                                                const lineVars = lineVariantsCache[compId] || []

                                                                if (lineVars.length > 0) {
                                                                    return (
                                                                        <div className="animate-in fade-in slide-in-from-top-1">
                                                                            <Select
                                                                                value={form.watch(`lines.${index}.component`)}
                                                                                onValueChange={(val) => {
                                                                                    form.setValue(`lines.${index}.component`, val)
                                                                                    const v = lineVars.find((vr: { id: string | number }) => vr.id.toString() === val)
                                                                                    if (v) {
                                                                                        form.setValue(`lines.${index}.component_name`, v.variant_display_name || v.name)
                                                                                        form.setValue(`lines.${index}.component_code`, v.internal_code || v.code)
                                                                                        form.setValue(`lines.${index}.component_cost`, Number(v.cost_price || 0))
                                                                                        if (v.uom_category) form.setValue(`lines.${index}.component_uom_category`, v.uom_category)
                                                                                        if (v.uom) {
                                                                                            const uomId = typeof v.uom === 'object' ? (v.uom as UoM).id.toString() : v.uom.toString()
                                                                                            form.setValue(`lines.${index}.uom`, uomId)
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="h-7 w-full text-[10px] bg-primary/5 border-primary/20">
                                                                                    <SelectValue placeholder="Seleccione variante..." />
                                                                                </SelectTrigger>
                                                                                <SelectContent position="popper" className="z-[110]">
                                                                                    {lineVars.map(v => (
                                                                                        <SelectItem key={v.id} value={v.id.toString()} className="text-[10px]">
                                                                                            {v.variant_display_name || v.name}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    )
                                                                }
                                                                return null
                                                            })()}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`lines.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <Input type="number" step="1" {...field} className="h-8 text-xs border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent transition-all text-center font-bold" />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`lines.${index}.uom`}
                                                            render={({ field }) => {
                                                                const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1;

                                                                return (
                                                                    <UoMSelector
                                                                        context="bom"
                                                                        categoryId={Number(form.watch(`lines.${index}.component_uom_category`)) || undefined}
                                                                        value={field.value || ""}
                                                                        onChange={(val) => {
                                                                            field.onChange(val);
                                                                            const selectedUom = uoms.find((u: { id: string | number }) => u.id.toString() === val);

                                                                            if (selectedUom) {
                                                                                form.setValue(`lines.${index}.uom_name`, selectedUom.name);
                                                                            }
                                                                        }}
                                                                        uoms={uoms}
                                                                        showConversionHint={false}
                                                                        quantity={quantity}
                                                                        label=""
                                                                        className="h-8 border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent"
                                                                    />
                                                                );
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-[10px] font-medium font-mono text-right text-muted-foreground">
                                                            {formatCurrency(form.watch(`lines.${index}.component_cost`) || 0)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => removeMaterial(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {materialFields.length === 0 && (
                                <div className="p-6 text-center text-muted-foreground border rounded-lg border-dashed bg-muted/5">
                                    <Package className="h-6 w-6 mx-auto mb-2 opacity-50 text-muted-foreground" />
                                    <p className="text-xs font-medium">Sin materias primas</p>
                                    <p className="text-[10px] opacity-70 mt-0.5">Defina los componentes y cantidades necesarias para fabricar el producto.</p>
                                </div>
                            )}


                            {form.formState.errors.lines && (
                                <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive mt-4">
                                    {form.formState.errors.lines.root?.message
                                        ? form.formState.errors.lines.root.message
                                        : `Hay errores en ${Object.keys(form.formState.errors.lines).length} componente(s). Verifique los campos en rojo.`
                                    }
                                </div>
                            )}
                        </div>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* SECTION 2: SERVICIOS TERCERIZADOS (Outsourced Services) */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <div className="flex items-center gap-2 pt-4 pb-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Servicios Tercerizados</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Truck className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">
                                            Servicios Tercerizados
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight opacity-70">
                                            {serviceFields.length} servicio(s) · Se pre-llenan en la OT al fabricar
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => appendService({
                                        component: "", quantity: 1, uom: "",
                                        supplier: "", supplier_name: "",
                                        gross_price: 0, document_type: "FACTURA", notes: ""
                                    })}
                                    className="gap-2 rounded-lg h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar Servicio
                                </Button>
                            </div>

                            {serviceFields.length > 0 && (
                                <div className="border rounded-lg overflow-hidden shadow-sm bg-white/50 backdrop-blur-sm border-border/60">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                                                <TableHead className="w-[25%] text-[10px] font-black uppercase tracking-widest py-4">Servicio</TableHead>
                                                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-widest py-4">Proveedor</TableHead>
                                                <TableHead className="w-[10%] text-[10px] font-black uppercase tracking-widest py-4">Cant.</TableHead>
                                                <TableHead className="w-[10%] text-[10px] font-black uppercase tracking-widest py-4">Unidad</TableHead>
                                                <TableHead className="w-[12%] text-right text-[10px] font-black uppercase tracking-widest py-4 text-primary">Bruto Unit.</TableHead>
                                                <TableHead className="w-[10%] text-[10px] font-black uppercase tracking-widest py-4">Doc.</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {serviceFields.map((field, index) => (
                                                <TableRow key={field.id} className="hover:bg-muted/10 transition-colors">
                                                    <TableCell className="py-2">
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`service_lines.${index}.component`}
                                                            render={({ field: propField }) => (
                                                                <div className="space-y-1">
                                                                    <ProductSelector
                                                                        value={propField.value}
                                                                        onSelect={(p) => {
                                                                            propField.onChange(p.id.toString())
                                                                            form.setValue(`service_lines.${index}.component_name`, p.name)
                                                                            if (p.uom) {
                                                                                const uomId = typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()
                                                                                form.setValue(`service_lines.${index}.uom`, uomId)
                                                                            }
                                                                            if (p.has_variants) {
                                                                                fetchLineVariants(p.id, index, true)
                                                                            }
                                                                        }}
                                                                        onChange={(val) => propField.onChange(val)}
                                                                        placeholder="Buscar servicio..."
                                                                        shouldResolveVariants={false}
                                                                        customFilter={(p: ProductMinimal & { product_type?: string, can_be_purchased?: boolean }) => !!(p.product_type === 'SERVICE' && p.can_be_purchased)}
                                                                        className="h-8 text-xs border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent"
                                                                    />
                                                                    {(() => {
                                                                        const compId = form.watch(`service_lines.${index}.component`)
                                                                        const lineVars = lineVariantsCache[compId] || []

                                                                        if (lineVars.length > 0) {
                                                                            return (
                                                                                <div className="animate-in fade-in slide-in-from-top-1">
                                                                                    <Select
                                                                                        value={form.watch(`service_lines.${index}.component`)}
                                                                                        onValueChange={(val) => {
                                                                                            form.setValue(`service_lines.${index}.component`, val)
                                                                                            const v = lineVars.find((vr: ProductMinimal) => vr.id.toString() === val)
                                                                                            if (v && v.uom) {
                                                                                                form.setValue(`service_lines.${index}.uom`, v.uom.toString())
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <SelectTrigger className="h-7 w-full text-[10px] bg-primary/5 border-primary/20">
                                                                                            <SelectValue placeholder="Variante..." />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent position="popper" className="z-[110]">
                                                                                            {lineVars.map(v => (
                                                                                                <SelectItem key={v.id} value={v.id.toString()} className="text-[10px]">
                                                                                                    {v.variant_display_name || v.name}
                                                                                                </SelectItem>
                                                                                            ))}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                            )
                                                                        }
                                                                        return null
                                                                    })()}
                                                                </div>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`service_lines.${index}.supplier`}
                                                            render={({ field: supplierField }) => (
                                                                <AdvancedContactSelector
                                                                    value={supplierField.value}
                                                                    onChange={(val) => supplierField.onChange(val)}
                                                                    onSelectContact={(c) => {
                                                                        supplierField.onChange(c.id.toString())
                                                                        form.setValue(`service_lines.${index}.supplier_name`, c.name)
                                                                    }}
                                                                    contactType="SUPPLIER"
                                                                    placeholder="Proveedor..."
                                                                    className="h-8 border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent"
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`service_lines.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <Input type="number" step="any" min="0" {...field} className="h-8 text-xs border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent transition-all text-center font-bold" />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`service_lines.${index}.uom`}
                                                            render={({ field }) => (
                                                                <UoMSelector
                                                                    context="bom"
                                                                    value={field.value || ""}
                                                                    onChange={field.onChange}
                                                                    uoms={uoms}
                                                                    showConversionHint={false}
                                                                    label=""
                                                                    className="h-8 border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent"
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`service_lines.${index}.gross_price`}
                                                            render={({ field }) => (
                                                                <Input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    placeholder="$0"
                                                                    {...field}
                                                                    className="h-8 text-xs border-transparent hover:border-border/60 focus:border-primary/40 bg-transparent transition-all text-right font-mono"
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <FormField
                                                            control={form.control as any}
                                                            name={`service_lines.${index}.document_type`}
                                                            render={({ field }) => (
                                                                <select
                                                                    className="w-full rounded-md border-transparent hover:border-border/60 bg-transparent px-2 py-1.5 text-xs ring-offset-background focus:ring-1 focus:ring-primary h-8 transition-all font-bold"
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                >
                                                                    <option value="FACTURA">Factura</option>
                                                                    <option value="BOLETA">Boleta</option>
                                                                </select>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                            onClick={() => removeService(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {serviceFields.length === 0 && (
                                <div className="p-6 text-center text-muted-foreground border rounded-lg border-dashed bg-muted/5">
                                    <Truck className="h-6 w-6 mx-auto mb-2 opacity-50 text-muted-foreground" />
                                    <p className="text-xs font-medium">Sin servicios tercerizados</p>
                                    <p className="text-[10px] opacity-70 mt-0.5">Defina los servicios tercerizados necesarios para fabricar el producto.</p>
                                </div>
                            )}


                        </div>
                    </form>
                </Form>
            </div>
        </BaseModal>
    )
}
