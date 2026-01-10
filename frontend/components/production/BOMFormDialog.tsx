"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"

// Schema
const bomSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    active: z.boolean().default(true),
    notes: z.string().optional(),
    lines: z.array(z.object({
        component: z.string().min(1, "Componente requerido"), // ID as string
        component_code: z.string().optional(), // For display
        component_name: z.string().optional(), // For display
        component_cost: z.number().optional(), // For display
        quantity: z.coerce.number().min(0.0001, "Cantidad debe ser mayor a 0"),
        uom: z.string().optional(), // UoM ID as string
        uom_name: z.string().optional(), // For display
        notes: z.string().optional()
    })).min(1, "Debe agregar al menos un componente")
})

// Explicit type to avoid inference mismatches
type BOMFormValues = {
    name: string
    active: boolean
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
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoms] = useState<any[]>([])

    useEffect(() => {
        setSelectedProduct(initialProduct)
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

    // Form
    const form = useForm<BOMFormValues>({
        resolver: zodResolver(bomSchema) as any, // Cast to any to bypass strict type mismatch between zod and rhf versions
        defaultValues: {
            name: "",
            active: true,
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
        setLoading(true)
        try {
            const payload = {
                product: selectedProduct.id || selectedProduct,
                ...data,
                lines: data.lines.map(l => ({
                    component: parseInt(l.component),
                    quantity: l.quantity,
                    uom: l.uom ? parseInt(l.uom) : null,
                    notes: l.notes
                }))
            }

            if (bomToEdit) {
                await api.patch(`/production/boms/${bomToEdit.id}/`, payload)
                toast.success("BOM actualizada correctamente")
            } else {
                await api.post("/production/boms/", payload)
                toast.success("BOM creada correctamente")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving BOM:", error)
            toast.error("Error al guardar BOM: " + (error.response?.data?.detail || error.message))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
            <DialogContent
                className="max-w-4xl max-h-[90vh] flex flex-col"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="pr-12">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Workflow className="h-5 w-5 text-primary" />
                        {bomToEdit ? `Editar BOM: ${bomToEdit.name}` : "Nueva Lista de Materiales"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {selectedProduct ? `Definiendo componentes para: ${selectedProduct.name} (${selectedProduct.internal_code || selectedProduct.code})` : 'Seleccione el producto para el cual desea crear la lista de materiales.'}
                    </DialogDescription>
                    {!initialProduct && (
                        <div className="mt-4 pb-2 border-b">
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
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-1">
                    <Form {...form}>
                        <form id="bom-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">

                            {/* Header Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre de la Lista</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Versión Estándar 2024" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between rounded-lg border p-3 mt-1">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Activa</FormLabel>
                                                    <FormDescription>
                                                        Solo una BOM activa por producto.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
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
                                        onClick={() => append({ component: "", quantity: 1, uom: "", notes: "" })}
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
                                                                                    form.setValue(`lines.${index}.uom`, p.uom.toString());
                                                                                    form.setValue(`lines.${index}.uom_name`, p.uom_name);
                                                                                }
                                                                                if (p && p.cost_price !== undefined) {
                                                                                    form.setValue(`lines.${index}.component_cost`, p.cost_price);
                                                                                }
                                                                            }}
                                                                            placeholder="Buscar componente..."
                                                                            allowedTypes={['STORABLE', 'CONSUMABLE', 'MANUFACTURABLE']}
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
                                                                        <Input type="number" step="0.0001" {...field} />
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
                                                                const componentId = form.watch(`lines.${index}.component`);
                                                                const product = products.find((p: any) => p.id.toString() === componentId?.toString());

                                                                // Build list of allowed UoMs for this component
                                                                const allowedUoms: any[] = [];
                                                                if (product) {
                                                                    // Add base UoM
                                                                    if (product.uom) {
                                                                        const baseUom = uoms.find((u: any) => u.id === product.uom);
                                                                        if (baseUom) allowedUoms.push(baseUom);
                                                                    }
                                                                    // Add sale UoM if different
                                                                    if (product.sale_uom && product.sale_uom !== product.uom) {
                                                                        const saleUom = uoms.find((u: any) => u.id === product.sale_uom);
                                                                        if (saleUom && !allowedUoms.find(u => u.id === saleUom.id)) {
                                                                            allowedUoms.push(saleUom);
                                                                        }
                                                                    }
                                                                    // Add allowed sale UoMs
                                                                    if (product.allowed_sale_uoms && product.allowed_sale_uoms.length > 0) {
                                                                        product.allowed_sale_uoms.forEach((uomId: any) => {
                                                                            const foundUom = uoms.find((u: any) => u.id === uomId);
                                                                            if (foundUom && !allowedUoms.find(u => u.id === foundUom.id)) {
                                                                                allowedUoms.push(foundUom);
                                                                            }
                                                                        });
                                                                    }
                                                                }

                                                                return (
                                                                    <FormItem>
                                                                        <Select
                                                                            onValueChange={(val) => {
                                                                                field.onChange(val);
                                                                                const selectedUom = uoms.find((u: any) => u.id.toString() === val);
                                                                                if (selectedUom) {
                                                                                    form.setValue(`lines.${index}.uom_name`, selectedUom.name);
                                                                                }
                                                                            }}
                                                                            value={field.value}
                                                                        >
                                                                            <FormControl>
                                                                                <SelectTrigger className="h-9">
                                                                                    <SelectValue placeholder="Seleccionar...">
                                                                                        {field.value ? uoms.find((u: any) => u.id.toString() === field.value)?.name : "Seleccionar..."}
                                                                                    </SelectValue>
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                {allowedUoms.map(u => (
                                                                                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                );
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-right font-mono text-sm text-muted-foreground">
                                                            ${(form.watch(`lines.${index}.component_cost`) || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.notes`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input {...field} placeholder="Opcional" />
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
                                    <p className="text-sm font-medium text-destructive">
                                        {form.formState.errors.lines.root?.message || "Error en las líneas"}
                                    </p>
                                )}
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="py-4 border-t mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button form="bom-form" type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar BOM
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
