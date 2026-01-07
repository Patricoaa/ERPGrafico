"use client"


import { useState, useEffect } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2, Box } from "lucide-react"
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
import { AttributeBadges } from "@/components/shared/AttributeBadges"

const saleLineSchema = z.object({
    id: z.number().optional(),
    product: z.string().optional(),
    description: z.string().min(1, "La descripción es requerida"),
    quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
    uom: z.string().min(1, "Unidad requerida"),
    unit_price: z.number().min(0, "El precio no puede ser negativo"),
    tax_rate: z.number(),
})

const saleOrderSchema = z.object({
    customer: z.string().min(1, "El cliente es requerido"),
    payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT"]),
    notes: z.string().optional(),
    lines: z.array(saleLineSchema).min(1, "Debe agregar al menos una línea"),
})

type SaleOrderFormValues = z.infer<typeof saleOrderSchema>

interface SaleOrderFormProps {
    onSuccess?: (order?: any) => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

const OrderTotals = ({ control }: { control: Control<SaleOrderFormValues> }) => {
    const lines = useWatch({
        control,
        name: "lines",
    })

    const subtotal = lines?.reduce((sum, line) => sum + (Number(line.quantity) * Number(line.unit_price) || 0), 0) || 0
    const tax = lines?.reduce((sum, line) => {
        const lineNet = Number(line.quantity) * Number(line.unit_price) || 0
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

export function SaleOrderForm({ onSuccess, initialData, open: openProp, onOpenChange }: SaleOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoMs] = useState<any[]>([])

    const form = useForm<SaleOrderFormValues>({
        resolver: zodResolver(saleOrderSchema),
        defaultValues: initialData ? {
            ...initialData,
            customer: initialData.customer?.toString() || "",
            lines: initialData.lines.map((l: any) => ({
                id: l.id,
                product: l.product?.toString() || "",
                description: l.description,
                quantity: parseFloat(l.quantity) || 0,
                uom: l.uom?.toString() || "",
                unit_price: parseFloat(l.unit_price) || 0,
                tax_rate: parseFloat(l.tax_rate) || 19,
            }))
        } : {
            customer: "",
            payment_method: "CREDIT",
            notes: "",
            lines: [{ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19 }],
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
                api.get('/inventory/uoms/')
            ])
            setProducts(productsRes.data.results || productsRes.data)
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
                    customer: initialData.customer?.id?.toString() || initialData.customer?.toString() || "",
                    lines: initialData.lines.map((l: any) => ({
                        id: l.id,
                        product: l.product?.toString() || "",
                        description: l.description,
                        quantity: parseFloat(l.quantity) || 0,
                        uom: l.uom?.toString() || "",
                        unit_price: parseFloat(l.unit_price) || 0,
                        tax_rate: parseFloat(l.tax_rate) || 19,
                    }))
                })
            } else {
                form.reset({
                    customer: "",
                    payment_method: "CREDIT",
                    notes: "",
                    lines: [{ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19 }],
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: SaleOrderFormValues) {
        setLoading(true)
        try {
            let res;
            if (initialData) {
                res = await api.put(`/sales/orders/${initialData.id}/`, data)
                toast.success("Nota de Venta actualizada correctamente")
            } else {
                res = await api.post('/sales/orders/', data)
                toast.success("Nota de Venta creada correctamente")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess(res?.data)
        } catch (error: any) {
            console.error("Error saving sale order:", error)
            toast.error(error.response?.data?.detail || "Error al guardar la Nota de Venta")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nueva Nota de Venta</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Nota de Venta" : "Crear Nota de Venta"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos de la nota de venta." : "Ingrese los detalles de la nueva nota de venta."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="customer"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cliente</FormLabel>
                                        <FormControl>
                                            <AdvancedContactSelector
                                                value={field.value}
                                                onChange={field.onChange}
                                                contactType="CUSTOMER"
                                                placeholder="Buscar cliente..."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Líneas de Venta</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19 })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Línea
                                </Button>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Producto</TableHead>
                                            <TableHead className="w-[10%]">Cantidad</TableHead>
                                            <TableHead className="w-[15%]">Unidad</TableHead>
                                            <TableHead className="w-[15%]">Precio Unit.</TableHead>
                                            <TableHead className="w-[15%]">Subtotal</TableHead>
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
                                                                    restrictStock={true}
                                                                    onChange={(value: string | null) => {
                                                                        field.onChange(value)
                                                                        // Auto-populate price, description and UoM from product
                                                                        const selectedProduct = products.find(p => p.id.toString() === value)
                                                                        if (selectedProduct) {
                                                                            form.setValue(`lines.${index}.unit_price`, parseFloat(selectedProduct.sale_price))
                                                                            form.setValue(`lines.${index}.description`, selectedProduct.name)
                                                                            form.setValue(`lines.${index}.uom`, selectedProduct.uom?.toString() || "")
                                                                        }
                                                                    }}
                                                                />
                                                                {field.value && (
                                                                    <div className="pl-1">
                                                                        {(() => {
                                                                            const prod = products.find(p => p.id.toString() === field.value)
                                                                            return prod?.attribute_values?.length > 0 && (
                                                                                <AttributeBadges attributes={prod.attribute_values} />
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                )}
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
                                                            const productId = form.watch(`lines.${index}.product`)
                                                            const selectedProduct = products.find(p => p.id.toString() === productId)

                                                            // Find category of product's base uom
                                                            const baseUoM = uoms.find(u => u.id === selectedProduct?.uom)
                                                            const categoryId = baseUoM?.category

                                                            const filteredUoMs = categoryId
                                                                ? uoms.filter(u => u.category === categoryId)
                                                                : uoms

                                                            return (
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                    disabled={!productId}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Unidad" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {filteredUoMs.map((u) => (
                                                                            <SelectItem key={u.id} value={u.id.toString()}>
                                                                                {u.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`lines.${index}.unit_price`}
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
                                                    {(Number(form.watch(`lines.${index}.quantity`)) * Number(form.watch(`lines.${index}.unit_price`)) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
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
                                                placeholder="Condiciones de pago, entrega, etc."
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
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Nota de Venta"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
