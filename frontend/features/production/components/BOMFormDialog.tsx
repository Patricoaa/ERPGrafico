"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm, useFieldArray, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
import { Plus, Trash2, Save, Loader2, Info, Workflow, Box, Layers, CheckCircle2, Truck, Package, AlertCircle } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"
import type { BOM, BOMLine, ProductMinimal, UoM } from "../types"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

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

type BOMFormValues = z.infer<typeof bomSchema>

interface BOMFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: ProductMinimal
    bomToEdit?: BOM
    onSuccess: () => void
}

export function BOMFormDialog({
    open,
    onOpenChange,
    product: initialProduct,
    bomToEdit,
    onSuccess
}: BOMFormDialogProps) {
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
        resolver: zodResolver(bomSchema) as Resolver<BOMFormValues>,
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5">
                        Cancelar
                    </Button>
                    <ActionSlideButton
                        form="bom-form"
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        className="rounded-md text-xs font-bold"
                    >
                        {form.formState.isSubmitting ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-3.5 w-3.5" />
                        )}
                        {bomToEdit ? "Guardar Cambios" : "Crear Receta"}
                    </ActionSlideButton>
                </div>
            }
        >
            {!initialProduct ? (
                <div className="mb-4 pb-4 border-b">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        <div className={cn(selectedProduct?.has_variants ? "md:col-span-7" : "md:col-span-12")}>
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">
                                Producto a fabricar
                            </Label>
                            <ProductSelector
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
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">
                                    Variante del producto
                                </Label>
                                <Select
                                    value={selectedVariant?.id?.toString() || ""}
                                    onValueChange={(val) => {
                                        const v = variants.find(varnt => varnt.id.toString() === val)
                                        setSelectedVariant(v || null)
                                    }}
                                    disabled={!!bomToEdit}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-lg bg-background border-border shadow-sm transition-all focus:ring-primary/20">
                                        <SelectValue placeholder="Seleccione variante..." />
                                    </SelectTrigger>
                                    <SelectContent position="popper" sideOffset={8} className="z-[100] rounded-lg overflow-hidden min-w-[320px]">
                                        {loadingVariants ? (
                                            <div className="p-3 text-[10px] text-center text-muted-foreground flex flex-col items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Cargando variantes...</span>
                                            </div>
                                        ) : variants.length > 0 ? (
                                            <div className="max-h-[300px] overflow-y-auto p-1">
                                                {variants.map(v => (
                                                    <SelectItem key={v.id} value={v.id.toString()} className="text-xs rounded-lg py-2 cursor-pointer hover:bg-primary/5">
                                                        <div className="flex flex-col gap-1 w-full">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-bold">{v.variant_display_name || v.name}</span>
                                                                <span className="text-[9px] text-muted-foreground uppercase font-mono bg-muted px-1 rounded">{v.internal_code || v.code}</span>
                                                            </div>
                                                            
                                                            {v.attribute_values_data && v.attribute_values_data.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                                    {(v as ProductMinimal).attribute_values_data?.map((attr: { id: string | number; value: string }) => (
                                                                        <span 
                                                                            key={attr.id} 
                                                                            className="text-[8px] h-3.5 px-1 py-0 font-bold uppercase rounded border border-primary/20 bg-primary/5 text-primary flex items-center"
                                                                        >
                                                                            {attr.value}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center space-y-2">
                                                <AlertCircle className="h-5 w-5 text-warning mx-auto" />
                                                <p className="text-[10px] text-muted-foreground italic">No se encontraron variantes disponibles para este producto.</p>
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mb-4 pb-3 border-b flex items-center justify-between bg-muted/10 p-4 rounded-md">
                   <div className="flex items-center gap-3">
                       <Box className="h-5 w-5 text-muted-foreground" />
                       <div className="flex flex-col">
                           <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Producto Base (Modo Lectura)</Label>
                           <span className="text-sm font-bold text-foreground">
                               {selectedVariant ? (selectedVariant.variant_display_name || selectedVariant.name) : (selectedProduct?.name || "")}
                           </span>
                       </div>
                   </div>
                   <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary">
                        Edición
                   </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-1">
                <Form {...form}>
                    <form id="bom-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {/* COLUMNA IZQUIERDA: IDENTIFICACIÓN */}
                            <div className="space-y-3">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Nombre de la Receta</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Versión Estándar 2024" {...field} className={cn(FORM_STYLES.input, "h-9")} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="active"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className={cn(
                                                "flex items-center gap-3 p-2 rounded-lg border border-border/50 transition-colors shadow-sm",
                                                field.value ? "bg-primary/5 border-primary/20" : "bg-muted/5 border-border"
                                            )}>
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background shadow-sm border">
                                                    {field.value ? (
                                                        <CheckCircle2 className={cn("h-3.5 w-3.5", field.value ? "text-primary" : "text-muted-foreground")} />
                                                    ) : (
                                                        <Workflow className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-0.5">
                                                    <FormLabel className={cn("text-[10px] font-bold uppercase tracking-widest cursor-pointer",
                                                        field.value ? "text-primary" : "text-muted-foreground"
                                                    )}>RECETA ACTIVA</FormLabel>
                                                    <div className={cn(
                                                        "text-[9px] font-semibold uppercase tracking-wider",
                                                        field.value ? "text-primary/70" : "text-muted-foreground/70"
                                                    )}>
                                                        {field.value ? "Lista Principal" : "Lista de Respaldo"}
                                                    </div>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className={cn(field.value && "data-[state=checked]:bg-primary scale-75")}
                                                    />
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* COLUMNA DERECHA: RENDIMIENTO */}
                            <div className="space-y-3">
                                <FormField
                                    control={form.control}
                                    name="yield_quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Rendimiento / Producción</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0.0001"
                                                    step="any"
                                                    placeholder="1"
                                                    {...field}
                                                    className={cn(FORM_STYLES.input, "h-9")}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="yield_uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Unidad de Salida</FormLabel>
                                            <FormControl>
                                                <UoMSelector
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    categoryId={selectedProduct?.uom_category}
                                                    uoms={uoms}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
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
                                                <TableRow key={field.id}>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <FormField
                                                                control={form.control}
                                                                name={`lines.${index}.component`}
                                                                render={({ field: propField }) => (
                                                                    <FormItem>
                                                                        <FormControl>
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
                                                                                className="h-8 text-xs"
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
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
                                                            control={form.control}
                                                            name={`lines.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" step="1" {...field} className={cn(FORM_STYLES.input, "h-8")} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.uom`}
                                                            render={({ field }) => {
                                                                const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1;

                                                                return (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <UoMSelector
                                                                                context="bom"
                                                                                categoryId={Number(form.watch(`lines.${index}.component_uom_category`)) || undefined}
                                                                                value={field.value || ""}
                                                                                onChange={(val) => {
                                                                                    field.onChange(val);
                                                                                    const selectedUom = uoms.find((u: { id: string | number }) => u.id.toString() === val);

                                                                                    if (selectedUom) {
                                                                                        form.setValue(`lines.${index}.uom_name`, selectedUom.name);
                                                                                        // Note: Cost calculation removed here as it requires base cost/ratio 
                                                                                        // logic from the original product which we might not have in full.
                                                                                        // The component_cost is pre-filled from onSelect and can be updated by quantity changes.
                                                                                    }
                                                                                }}
                                                                                uoms={uoms}
                                                                                showConversionHint={false}
                                                                                quantity={quantity}
                                                                                label=""
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
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
                                                <TableRow key={field.id}>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`service_lines.${index}.component`}
                                                            render={({ field: propField }) => (
                                                                <FormItem>
                                                                    <FormControl>
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
                                                                            />
                                                                            {(() => {
                                                                                const compId = form.watch(`service_lines.${index}.component`)
                                                                                const lineVars = lineVariantsCache[compId] || []
                                                                                
                                                                                if (lineVars.length > 0) {
                                                                                    return (
                                                                                        <div className="mt-1 animate-in fade-in slide-in-from-top-1">
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
                                                                                                    <SelectValue placeholder="Variante requerida..." />
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
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`service_lines.${index}.supplier`}
                                                            render={({ field: supplierField }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <AdvancedContactSelector
                                                                            value={supplierField.value}
                                                                            onChange={(val) => supplierField.onChange(val)}
                                                                            onSelectContact={(c) => {
                                                                                supplierField.onChange(c.id.toString())
                                                                                form.setValue(`service_lines.${index}.supplier_name`, c.name)
                                                                            }}
                                                                            contactType="SUPPLIER"
                                                                            placeholder="Proveedor..."
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`service_lines.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" step="1" min="1" {...field} className={cn(FORM_STYLES.input, "h-8")} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                            <FormField
                                                                control={form.control}
                                                                name={`service_lines.${index}.uom`}
                                                                render={({ field }) => {
                                                                    return (
                                                                        <FormItem>
                                                                            <FormControl>
                                                                                <UoMSelector
                                                                                    context="bom"
                                                                                    value={field.value || ""}
                                                                                    onChange={field.onChange}
                                                                                    uoms={uoms}
                                                                                    showConversionHint={false}
                                                                                    label=""
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )
                                                                }}
                                                            />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`service_lines.${index}.gross_price`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            step="1"
                                                                            min="0"
                                                                            placeholder="$0"
                                                                            {...field}
                                                                            className={cn(FORM_STYLES.input, "h-8 text-right")}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`service_lines.${index}.document_type`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <select
                                                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs ring-offset-background focus:ring-1 focus:ring-primary h-8"
                                                                            value={field.value}
                                                                            onChange={field.onChange}
                                                                        >
                                                                            <option value="FACTURA">Factura</option>
                                                                            <option value="BOLETA">Boleta</option>
                                                                        </select>
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
