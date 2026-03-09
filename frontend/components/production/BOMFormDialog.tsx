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
import { Plus, Trash2, Save, Loader2, Info, Workflow } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"

// Schema
const bomSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    active: z.boolean().default(true),
    yield_quantity: z.coerce.number().min(0.0001, "El rendimiento debe ser mayor a 0").default(1),
    yield_uom: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(z.object({
        component: z.string().min(1, "Componente requerido"), // ID as string
        component_code: z.string().optional(), // For display
        component_name: z.string().optional(), // For display
        component_cost: z.number().optional(), // For display
        quantity: z.coerce.number().min(1, "Cantidad debe ser mayor a 0"),
        uom: z.string().min(1, "Unidad requerida"), // UoM ID as string - REQUIRED
        uom_name: z.string().optional(), // For display
        notes: z.string().optional()
    })).min(1, "Debe agregar al menos un componente")
})

// Explicit type to avoid inference mismatches
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
}

interface BOMFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: any // Optional, if null, allow selection
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
                
                // If editing/cloning, pre-select the variant that matches the BOM's product
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

    // Form
    const form = useForm<BOMFormValues>({
        resolver: zodResolver(bomSchema) as any, // Cast to any to bypass strict type mismatch between zod and rhf versions
        defaultValues: {
            name: "",
            active: true,
            yield_quantity: 1,
            yield_uom: "",
            notes: "",
            lines: []
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines"
    })

    // Reset form when dialog opens/closes or bomToEdit changes
    useEffect(() => {
        if (open) {
            if (bomToEdit) {
                form.reset({
                    name: bomToEdit.name,
                    active: bomToEdit.active,
                    yield_quantity: bomToEdit.yield_quantity || 1,
                    yield_uom: bomToEdit.yield_uom?.toString() || "",
                    notes: bomToEdit.notes || "",
                    lines: bomToEdit.lines.map((l: any) => ({
                        component: l.component.toString(),
                        component_code: l.component_code,
                        component_name: l.component_name,
                        component_cost: l.component_cost || 0,
                        quantity: l.quantity,
                        uom: l.uom?.toString() || "",
                        uom_name: l.uom_name || "",
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
                    lines: []
                })
            }
        }
    }, [open, bomToEdit, form])

    const onSubmit = async (data: BOMFormValues) => {
        if (!selectedProduct) {
            toast.error("Debe seleccionar un producto")
            return
        }

        // Validate variant selection for products with variants
        if (selectedProduct.has_variants && !selectedVariant) {
            toast.error("Debe seleccionar una variante específica para asignar el BOM")
            return
        }

        setLoading(true)
        try {
            // Use variant if selected, otherwise use product
            const targetProductId = selectedVariant?.id || selectedProduct.id || selectedProduct

            const payload = {
                product: targetProductId,
                ...data,
                yield_quantity: data.yield_quantity,
                yield_uom: data.yield_uom ? parseInt(data.yield_uom) : null,
                lines: data.lines.map(l => ({
                    component: parseInt(l.component),
                    quantity: l.quantity,
                    uom: l.uom ? parseInt(l.uom) : null,
                    notes: l.notes
                }))
            }

            if (bomToEdit && bomToEdit.id) {
                await api.patch(`/production/boms/${bomToEdit.id}/`, payload)
                toast.success("BOM actualizada correctamente")
            } else {
                await api.post("/production/boms/", payload)
                toast.success("BOM creada correctamente")
            }
            if (onSuccess) onSuccess()

            // Small delay before closing to let Radix UI clean up and prevent parent dialog closure
            setTimeout(() => {
                onOpenChange(false)
            }, 100)
        } catch (error: any) {
            console.error("Error saving BOM:", error)
            toast.error("Error al guardar BOM: " + (error.response?.data?.detail || error.message))
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
                <div className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-primary" />
                    {bomToEdit ? `Editar BOM: ${bomToEdit.name}` : "Nueva Lista de Materiales"}
                </div>
            }
            description={
                selectedVariant
                    ? `Definiendo componentes para variante: ${selectedVariant.variant_display_name || selectedVariant.name}`
                    : selectedProduct
                        ? `Definiendo componentes para: ${selectedProduct.name} (${selectedProduct.internal_code || selectedProduct.code})`
                        : 'Seleccione el producto para el cual desea crear la lista de materiales.'
            }
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        form="bom-form"
                        type="submit"
                        disabled={loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar BOM
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

                        {/* Header Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
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
                                            disabled={!!bomToEdit} // Disable variant change when editing
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
                                        <FormItem className="flex flex-col gap-1">
                                            <div className={cn("flex items-center justify-between mt-6", FORM_STYLES.card)}>
                                                <FormLabel className={FORM_STYLES.label}>Activa</FormLabel>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="scale-75"
                                                    />
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Yield Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
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
                                            <FormDescription className="text-[10px] mt-1">
                                                Si se omite, se usa la unidad base del producto.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Instrucciones especiales..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Components Table */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Componentes y Materias Primas
                                </h3>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => append({ component: "", quantity: 1, uom: "", component_cost: 0, notes: "" })}
                                    className="gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar Componente
                                </Button>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Componente</TableHead>
                                            <TableHead className="w-[15%]">Cantidad</TableHead>
                                            <TableHead className="w-[12%]">Unidad</TableHead>
                                            <TableHead className="w-[13%] text-right">Costo Unit.</TableHead>
                                            <TableHead>Notas</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
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
                                                                            // Auto-set uom and cost if empty
                                                                            const p = products.find((prod: any) => prod.id.toString() === val?.toString());
                                                                            if (p && p.uom) {
                                                                                form.setValue(`lines.${index}.uom`, p.uom.toString(), { shouldValidate: true });
                                                                                form.setValue(`lines.${index}.uom_name`, p.uom_name);
                                                                                // Store base cost (cost in base UoM)
                                                                                const baseCost = Number(p.cost_price || 0);
                                                                                form.setValue(`lines.${index}.component_cost`, baseCost);
                                                                            }
                                                                        }}
                                                                        placeholder="Buscar componente..."
                                                                        allowedTypes={['STORABLE', 'CONSUMABLE', 'MANUFACTURABLE']}
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
                                                                                field.onChange(val); // This should trigger validation automatically
                                                                                const selectedUom = uoms.find((u: any) => u.id.toString() === val);

                                                                                if (selectedUom && component) {
                                                                                    form.setValue(`lines.${index}.uom_name`, selectedUom.name);

                                                                                    // Calculate new unit cost based on conversion ratio
                                                                                    // Cost_New = Cost_Base * (Ratio_New / Ratio_Base)
                                                                                    // Since prices are usually stored in Base UoM (where ratio=1 or reference), 
                                                                                    // and UoM ratio is "how many base units in this unit" (e.g. kg=1, g=0.001)
                                                                                    // Cost per kg = $1000
                                                                                    // Cost per g = $1000 * 0.001 = $1

                                                                                    const baseCost = Number(component.cost_price || 0);

                                                                                    // Find component's base UoM ratio (usually the reference one in category, or the one assigned to product)
                                                                                    // Assuming component.uom is the base ID. We need its ratio.
                                                                                    const baseUomId = component.uom;
                                                                                    const baseUom = uoms.find(u => u.id === baseUomId);

                                                                                    if (baseUom) {
                                                                                        const baseRatio = Number(baseUom.ratio);
                                                                                        const newRatio = Number(selectedUom.ratio);

                                                                                        if (baseRatio > 0) {
                                                                                            // Standard conversion: Convert base cost to Reference (div by baseRatio), then to New (mult by newRatio)
                                                                                            // Price is inversely proportional to quantity ratio? 
                                                                                            // No. If 1 Box (10 units) costs $100. 1 Unit costs $10.
                                                                                            // Ratio Box = 10. Ratio Unit = 1.
                                                                                            // Cost Box = Cost Unit * 10.
                                                                                            // So Cost = BaseCost * (NewRatio / BaseRatio)

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
                                                    <div className="text-[10px] text-muted-foreground font-mono">
                                                        {formatCurrency(form.watch(`lines.${index}.component_cost`) || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`lines.${index}.notes`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input {...field} placeholder="Opcional" className={cn(FORM_STYLES.input, "h-8")} />
                                                                </FormControl>
                                                                <FormMessage />
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
                                                        onClick={() => remove(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {fields.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No hay componentes definidos. Agregue uno para comenzar.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {form.formState.errors.lines && (
                                <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive mt-4">


                                    {form.formState.errors.lines.root?.message
                                        ? form.formState.errors.lines.root.message
                                        : `Hay errores en ${Object.keys(form.formState.errors.lines).length} componente(s). Verifique los campos en rojo.`
                                    }
                                </div>
                            )}
                        </div>
                    </form>
                </Form>
            </div>

        </BaseModal >
    )
}
