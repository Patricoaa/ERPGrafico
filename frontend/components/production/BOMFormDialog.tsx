"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
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
import { Plus, Trash2, Save, Loader2, Info, Workflow, Box, Layers, CheckCircle2, Truck, Package } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"

// Schema for material lines (stock components)
const materialLineSchema = z.object({
    component: z.string().min(1, "Componente requerido"),
    component_code: z.string().optional(),
    component_name: z.string().optional(),
    component_cost: z.number().optional(),
    quantity: z.coerce.number().min(1, "Cantidad debe ser mayor a 0"),
    uom: z.string().min(1, "Unidad requerida"),
    uom_name: z.string().optional(),
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
    notes: z.string().optional(),
    lines: z.array(materialLineSchema).min(0),
    service_lines: z.array(serviceLineSchema).min(0)
}).refine(data => data.lines.length > 0 || data.service_lines.length > 0, {
    message: "Debe agregar al menos un componente o servicio tercerizado",
    path: ["lines"]
})

type BOMFormValues = {
    name: string
    active: boolean
    yield_quantity: number
    yield_uom?: string
    notes?: string
    lines: {
        component: string
        component_code?: string
        component_name?: string
        component_cost?: number
        quantity: number
        uom?: string
        uom_name?: string
        notes?: string
    }[]
    service_lines: {
        component: string
        component_name?: string
        quantity: number
        uom?: string
        uom_name?: string
        supplier: string
        supplier_name?: string
        gross_price: number
        document_type: string
        notes?: string
    }[]
}

interface BOMFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: any
    bomToEdit?: any
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
    const [selectedProduct, setSelectedProduct] = useState<any>(initialProduct)
    const [selectedVariant, setSelectedVariant] = useState<any>(null)
    const [variants, setVariants] = useState<any[]>([])
    const [loadingVariants, setLoadingVariants] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoms] = useState<any[]>([])

    useEffect(() => {
        setSelectedProduct(initialProduct)
        setSelectedVariant(null)
        setVariants([])
    }, [initialProduct])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, uRes] = await Promise.all([
                    api.get('/inventory/products/'),
                    api.get('/inventory/uoms/')
                ])
                setProducts(pRes.data.results || pRes.data)
                setUoms(uRes.data.results || uRes.data)
            } catch (error) {
                console.error("Error fetching dependencies for BOMForm:", error)
            }
        }
        fetchData()
    }, [])

    // Fetch variants when product has_variants is true
    useEffect(() => {
        const fetchVariants = async () => {
            if (!selectedProduct?.id || !selectedProduct?.has_variants) {
                setVariants([])
                setSelectedVariant(null)
                return
            }

            setLoadingVariants(true)
            try {
                const res = await api.get(`/inventory/products/?parent_template=${selectedProduct.id}`)
                const loadedVariants = res.data.results || res.data
                setVariants(loadedVariants)

                if (bomToEdit && bomToEdit.product) {
                    const activeVariant = loadedVariants.find((v: any) => v.id === bomToEdit.product)
                    if (activeVariant) {
                        setSelectedVariant(activeVariant)
                    }
                }
            } catch (error) {
                console.error("Error fetching variants:", error)
                toast.error("Error al cargar variantes")
            } finally {
                setLoadingVariants(false)
            }
        }
        fetchVariants()
    }, [selectedProduct, bomToEdit])

    const form = useForm<BOMFormValues>({
        resolver: zodResolver(bomSchema) as any,
        defaultValues: {
            name: "",
            active: true,
            yield_quantity: 1,
            yield_uom: "",
            notes: "",
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
                const allLines = bomToEdit.lines || []
                const stockLines = allLines.filter((l: any) => !l.is_outsourced)
                const outsourcedLines = allLines.filter((l: any) => l.is_outsourced)

                form.reset({
                    name: bomToEdit.name,
                    active: bomToEdit.active,
                    yield_quantity: bomToEdit.yield_quantity || 1,
                    yield_uom: bomToEdit.yield_uom?.toString() || "",
                    notes: bomToEdit.notes || "",
                    lines: stockLines.map((l: any) => ({
                        component: l.component.toString(),
                        component_code: l.component_code,
                        component_name: l.component_name,
                        component_cost: l.component_cost || 0,
                        quantity: l.quantity,
                        uom: l.uom?.toString() || "",
                        uom_name: l.uom_name || "",
                        notes: l.notes || ""
                    })),
                    service_lines: outsourcedLines.map((l: any) => ({
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
                    notes: "",
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
                notes: l.notes,
                is_outsourced: false
            }))

            const servicePayloadLines = data.service_lines.map(l => ({
                component: parseInt(l.component),
                quantity: l.quantity,
                uom: l.uom ? parseInt(l.uom) : null,
                notes: l.notes,
                is_outsourced: true,
                supplier: parseInt(l.supplier),
                unit_price: Math.round(l.gross_price / 1.19),
                document_type: l.document_type
            }))

            const payload = {
                product: targetProductId,
                name: data.name,
                active: data.active,
                yield_quantity: data.yield_quantity,
                yield_uom: data.yield_uom ? parseInt(data.yield_uom) : null,
                notes: data.notes,
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
        } catch (error: any) {
            console.error("Error saving BOM:", error)
            toast.error("Error al guardar Lista de Materiales: " + (error.response?.data?.detail || error.message))
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
                    <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm border border-primary/5">
                        <Workflow className="h-5 w-5" />
                    </div>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-bold border-primary/20 hover:bg-primary/5">
                        Cancelar
                    </Button>
                    <Button
                        form="bom-form"
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        className="rounded-xl text-xs font-bold"
                    >
                        {form.formState.isSubmitting ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-3.5 w-3.5" />
                        )}
                        {bomToEdit ? "Guardar Cambios" : "Crear Receta"}
                    </Button>
                </div>
            }
        >
            {!initialProduct && (
                <div className="mb-4 pb-2 border-b">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Producto a fabricar</Label>
                    <ProductSelector
                        value={selectedProduct?.id || selectedProduct}
                        onChange={(val) => {
                            const p = products.find(prod => prod.id.toString() === val?.toString())
                            setSelectedProduct(p)
                        }}
                        placeholder="Seleccionar producto..."
                        allowedTypes={['MANUFACTURABLE']}
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-1">
                <Form {...form}>
                    <form id="bom-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">

                        {/* Standardized Separator: Información General */}
                        <div className="flex items-center gap-2 pt-2 pb-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Información de la Receta</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                            <div className={cn(selectedProduct?.has_variants ? "md:col-span-4" : "md:col-span-8")}>
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Nombre de la Lista</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Versión Estándar 2024" {...field} className={FORM_STYLES.input} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {selectedProduct?.has_variants && (
                                <div className="md:col-span-4">
                                    <div className="space-y-2">
                                        <Label className={FORM_STYLES.label}>Variante Asociada</Label>
                                        <Select
                                            value={selectedVariant?.id?.toString() || ""}
                                            onValueChange={(val) => {
                                                const v = variants.find(varnt => varnt.id.toString() === val)
                                                setSelectedVariant(v)
                                            }}
                                            disabled={!!bomToEdit}
                                        >
                                            <SelectTrigger className={FORM_STYLES.input}>
                                                <SelectValue placeholder="Seleccionar variante..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {variants.map(v => (
                                                    <SelectItem key={v.id} value={v.id.toString()}>
                                                        {v.variant_display_name || v.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground italic">La receta se asignará a esta variante específica.</p>
                                    </div>
                                </div>
                            )}

                            <div className="md:col-span-4">
                                <FormField
                                    control={form.control}
                                    name="active"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border border-border/50 transition-colors shadow-sm",
                                                field.value ? "bg-primary/5 border-primary/20" : "bg-muted/5 border-border"
                                            )}>
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm border">
                                                    {field.value ? (
                                                        <CheckCircle2 className={cn("h-3.5 w-3.5", field.value ? "text-primary" : "text-muted-foreground")} />
                                                    ) : (
                                                        <Workflow className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-0.5">
                                                    <FormLabel className={cn("text-xs font-bold uppercase tracking-widest cursor-pointer",
                                                        field.value ? "text-primary" : "text-muted-foreground"
                                                    )}>RECETA ACTIVA</FormLabel>
                                                    <div className={cn(
                                                        "text-[10px] font-bold uppercase tracking-wider",
                                                        field.value ? "text-primary" : "text-muted-foreground"
                                                    )}>
                                                        {field.value ? "Lista Activa" : "Lista Inactiva"}
                                                    </div>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className={cn(field.value && "data-[state=checked]:bg-primary")}
                                                    />
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Standardized Separator: Rendimiento */}
                        <div className="flex items-center gap-2 pt-2 pb-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rendimiento y Salida</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                            <div className="md:col-span-4">
                                <FormField
                                    control={form.control}
                                    name="yield_quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Esta receta rinde / produce:</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0.0001"
                                                    step="any"
                                                    placeholder="1"
                                                    {...field}
                                                    className={FORM_STYLES.input}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="md:col-span-4">
                                <FormField
                                    control={form.control}
                                    name="yield_uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Unidad de Rendimiento (Opcional)</FormLabel>
                                            <FormControl>
                                                <UoMSelector
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    categoryId={selectedProduct?.uom_category}
                                                    uoms={uoms}
                                                />
                                            </FormControl>
                                            <FormDescription className="text-[10px] mt-1 italic">
                                                Si se omite, se usa la unidad base del producto.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="md:col-span-4">
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Notas e Instrucciones</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Instrucciones especiales para la fabricación..."
                                                    {...field}
                                                    className={cn(FORM_STYLES.input, "min-h-[42px] py-2 resize-none")}
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
                            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Package className="h-4 w-4 text-primary" />
                                    </div>
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
                                    className="gap-2 rounded-xl h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar Línea
                                </Button>
                            </div>

                            {materialFields.length > 0 && (
                                <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 backdrop-blur-sm border-border/60">
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
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.component`}
                                                            render={({ field: propField }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <ProductSelector
                                                                            value={propField.value}
                                                                            onChange={(val: string | null) => {
                                                                                propField.onChange(val)
                                                                                const p = products.find((prod: any) => prod.id.toString() === val?.toString());
                                                                                if (p && p.uom) {
                                                                                    form.setValue(`lines.${index}.uom`, p.uom.toString(), { shouldValidate: true });
                                                                                    form.setValue(`lines.${index}.uom_name`, p.uom_name);
                                                                                    const baseCost = Number(p.cost_price || 0);
                                                                                    form.setValue(`lines.${index}.component_cost`, baseCost);
                                                                                }
                                                                            }}
                                                                            placeholder="Buscar componente..."
                                                                            allowedTypes={['STORABLE', 'MANUFACTURABLE']}
                                                                            excludeIds={selectedProduct ? [selectedProduct.id] : []}
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
                                                                const componentId = form.watch(`lines.${index}.component`) || "";
                                                                const component = products.find((p: any) => p.id.toString() === componentId);
                                                                const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1;

                                                                return (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <UoMSelector
                                                                                product={component || null}
                                                                                context="bom"
                                                                                value={field.value || ""}
                                                                                onChange={(val) => {
                                                                                    field.onChange(val);
                                                                                    const selectedUom = uoms.find((u: any) => u.id.toString() === val);

                                                                                    if (selectedUom && component) {
                                                                                        form.setValue(`lines.${index}.uom_name`, selectedUom.name);
                                                                                        const baseCost = Number(component.cost_price || 0);
                                                                                        const baseUomId = component.uom;
                                                                                        const baseUom = uoms.find(u => u.id === baseUomId);

                                                                                        if (baseUom) {
                                                                                            const baseRatio = Number(baseUom.ratio);
                                                                                            const newRatio = Number(selectedUom.ratio);
                                                                                            if (baseRatio > 0) {
                                                                                                const newCost = baseCost * (newRatio / baseRatio);
                                                                                                form.setValue(`lines.${index}.component_cost`, newCost);
                                                                                            }
                                                                                        }
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
                                <div className="p-6 text-center text-muted-foreground border rounded-xl border-dashed bg-muted/5">
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
                            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Truck className="h-4 w-4 text-primary" />
                                    </div>
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
                                    className="gap-2 rounded-xl h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar Servicio
                                </Button>
                            </div>

                            {serviceFields.length > 0 && (
                                <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 backdrop-blur-sm border-border/60">
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
                                                                            onChange={(val: string | null) => {
                                                                                propField.onChange(val)
                                                                                const p = products.find((prod: any) => prod.id.toString() === val?.toString());
                                                                                if (p) {
                                                                                    form.setValue(`service_lines.${index}.component_name`, p.name);
                                                                                    if (p.uom) {
                                                                                        form.setValue(`service_lines.${index}.uom`, typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString());
                                                                                    }
                                                                                }
                                                                            }}
                                                                            placeholder="Buscar servicio..."
                                                                            customFilter={(p: any) => p.product_type === 'SERVICE' && p.can_be_purchased}
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
                                                                const componentId = form.watch(`service_lines.${index}.component`) || "";
                                                                const component = products.find((p: any) => p.id.toString() === componentId);
                                                                return (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <UoMSelector
                                                                                product={component || null}
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
                                <div className="p-6 text-center text-muted-foreground border rounded-xl border-dashed bg-muted/5">
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
