"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import { toast } from "sonner"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"

const purchaseLineSchema = z.object({
    id: z.number().optional(),
    product: z.string().min(1, "El producto es requerido"),
    quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
    uom: z.string().min(1, "Unidad requerida"),
    unit_cost: z.number().min(0, "El costo no puede ser negativo"),
    tax_rate: z.number(),
})

const purchaseOrderSchema = z.object({
    notes: z.string().optional(),
    lines: z.array(purchaseLineSchema).min(1, "Debe agregar al menos una línea"),
})

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>

interface PurchaseOrderFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onCheckout?: (orderLines: any[], total: number) => void
}

const OrderTotals = ({ control }: { control: Control<PurchaseOrderFormValues> }) => {
    const lines = useWatch({
        control,
        name: "lines",
    })

    const subtotal = lines?.reduce((sum, line) => sum + (Number(line.quantity) * Number(line.unit_cost) || 0), 0) || 0
    const tax = lines?.reduce((sum, line) => {
        const lineNet = Number(line.quantity) * Number(line.unit_cost) || 0
        return sum + (lineNet * (Number(line.tax_rate) / 100))
    }, 0) || 0
    const total = subtotal + tax

    return (
        <div className="space-y-1 text-right pt-4 border-t">
            <div className="text-sm text-muted-foreground">
                Subtotal: {subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
            </div>
            <div className="text-sm text-muted-foreground">
                IVA (19%): {tax.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
            </div>
            <div className="text-lg font-bold">
                Total: {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
            </div>
        </div>
    )
}

export function PurchaseOrderForm({ onSuccess, initialData, open: openProp, onOpenChange, onCheckout }: PurchaseOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoMs] = useState<any[]>([])

    const form = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderSchema),
        defaultValues: initialData ? {
            ...initialData,
            lines: initialData.lines.map((l: any) => ({
                id: l.id,
                product: l.product?.id?.toString() || l.product?.toString() || "",
                quantity: parseFloat(l.quantity) || 0,
                uom: l.uom?.toString() || "",
                unit_cost: parseFloat(l.unit_cost) || 0,
                tax_rate: parseFloat(l.tax_rate) || 19,
            }))
        } : {
            notes: "",
            lines: [{ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    })

    const fetchData = async () => {
        try {
            const [productsRes, uomsRes] = await Promise.all([
                api.get('/inventory/products/'),
                api.get('/inventory/uoms/'),
            ])

            // Filter products to exclude SERVICE, MANUFACTURABLE_STANDARD, and MANUFACTURABLE_CUSTOM
            const allProducts = productsRes.data.results || productsRes.data
            const allowedTypes = ['STORABLE', 'CONSUMABLE']
            const filteredProducts = allProducts.filter((p: any) => allowedTypes.includes(p.product_type))

            setProducts(filteredProducts)
            setUoMs(uomsRes.data.results || uomsRes.data)
        } catch (error) {
            console.error("Error fetching data:", error)
        }
    }



    useEffect(() => {
        if (open) {
            fetchData()
            if (initialData) {
                form.reset({
                    ...initialData,
                    lines: initialData.lines.map((l: any) => ({
                        id: l.id,
                        product: l.product?.id?.toString() || l.product?.toString() || "",
                        quantity: parseFloat(l.quantity) || 0,
                        uom: l.uom?.toString() || "",
                        unit_cost: parseFloat(l.unit_cost) || 0,
                        tax_rate: parseFloat(l.tax_rate) || 19,
                    }))
                })
            } else {
                form.reset({
                    notes: "",
                    lines: [{ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }],
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: PurchaseOrderFormValues) {
        // For new orders, trigger the checkout wizard
        if (!initialData && onCheckout) {
            const lines = useWatch({ control: form.control, name: "lines" }) || data.lines
            const total = lines.reduce((sum, line) => {
                const lineNet = Number(line.quantity) * Number(line.unit_cost) || 0
                const lineTax = lineNet * (Number(line.tax_rate) / 100)
                return sum + lineNet + lineTax
            }, 0)

            // Prepare order lines with product details
            const orderLines = await Promise.all(data.lines.map(async (line) => {
                const product = products.find(p => p.id.toString() === line.product)
                return {
                    id: product?.id,
                    name: product?.name,
                    qty: line.quantity,
                    quantity: line.quantity,
                    uom: line.uom,
                    unit_cost: line.unit_cost,
                    tax_rate: line.tax_rate
                }
            }))

            onCheckout(orderLines, total)
            setOpen(false)
            return
        }

        // For editing existing orders, save normally
        setLoading(true)
        try {
            if (initialData) {
                await api.put(`/purchasing/orders/${initialData.id}/`, data)
                toast.success("Orden de Compra actualizada correctamente")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving purchase order:", error)
            toast.error(error.response?.data?.detail || "Error al guardar la Orden de Compra")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nueva Orden de Compra</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Orden de Compra" : "Crear Orden de Compra"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos de la orden de compra." : "Ingrese los detalles de la nueva orden de compra."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Líneas de Compra</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Producto
                                </Button>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[35%]">Producto</TableHead>
                                            <TableHead className="w-[10%]">Cantidad</TableHead>
                                            <TableHead className="w-[20%]">Unidad</TableHead>
                                            <TableHead className="w-[15%]">costo Unit.</TableHead>
                                            <TableHead className="w-[10%]">Subtotal</TableHead>
                                            <TableHead className="w-[10%]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
                                            <TableRow key={field.id}>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`lines.${index}.product`}
                                                        render={({ field }) => (
                                                            <div className="space-y-1">
                                                                <ProductSelector
                                                                    value={field.value}
                                                                    allowedTypes={['STORABLE', 'CONSUMABLE']}
                                                                    context="purchase"
                                                                    onChange={(val) => {
                                                                        field.onChange(val)
                                                                        // Automatically set unit_cost and UoM if product selected
                                                                        if (val) {
                                                                            const prod = products.find(p => p.id.toString() === val)
                                                                            if (prod) {
                                                                                form.setValue(`lines.${index}.unit_cost`, parseFloat(prod.last_purchase_price) || 0)
                                                                                form.setValue(`lines.${index}.uom`, (prod.purchase_uom || prod.uom)?.toString() || "")
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`lines.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                {...field}
                                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`lines.${index}.uom`}
                                                        render={({ field }) => {
                                                            const productId = form.watch(`lines.${index}.product`) || ""
                                                            const selectedProduct = products.find(p => p.id.toString() === productId)
                                                            const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1

                                                            return (
                                                                <UoMSelector
                                                                    product={selectedProduct || null}
                                                                    context="purchase"
                                                                    value={field.value || ""}
                                                                    onChange={field.onChange}
                                                                    uoms={uoms}
                                                                    showConversionHint={true}
                                                                    quantity={quantity}
                                                                    label="Unidad"
                                                                />
                                                            )
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`lines.${index}.unit_cost`}
                                                        render={({ field }) => (
                                                            <Input
                                                                type="number"
                                                                step="1"
                                                                {...field}
                                                                onChange={(e) => field.onChange(Math.ceil(parseFloat(e.target.value) || 0))}
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {(Number(form.watch(`lines.${index}.quantity`)) * Number(form.watch(`lines.${index}.unit_cost`)) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => remove(index)}
                                                        disabled={fields.length === 1}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notas / Observaciones</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Notas adicionales..."
                                                className="resize-none h-24"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <OrderTotals control={form.control} />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Orden de Compra"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
