"use client"


import { useState, useEffect } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2, Box, Info } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { PricingUtils } from "@/lib/pricing"

const saleLineSchema = z.object({
    id: z.number().optional(),
    product: z.string().optional(),
    description: z.string().min(1, "La descripción es requerida"),
    quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
    uom: z.string().min(1, "Unidad requerida"),
    unit_price: z.number().min(0, "El precio no puede ser negativo"),
    tax_rate: z.number().default(19),
    custom_specs: z.record(z.string(), z.any()).optional(),
    manufacturing_data: z.any().optional(),
})

const saleOrderSchema = z.object({
    payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT"]),
    notes: z.string().optional(),
    lines: z.array(saleLineSchema).min(1, "Debe agregar al menos una línea"),
})

type SaleOrderFormValues = z.infer<typeof saleOrderSchema>

interface SaleOrderFormProps {
    onSuccess?: (order?: any) => void
    onConfirmCheckout?: (data: any) => void
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

const DynamicFieldsRenderer = ({ schema, value, onChange }: { schema: any, value: any, onChange: (val: any) => void }) => {
    if (!schema) return null

    let fields = {}
    try {
        fields = typeof schema === 'string' ? JSON.parse(schema) : schema
    } catch (e) {
        console.error("Invalid JSON schema", schema)
        return null
    }

    if (typeof fields !== 'object' || fields === null) return null

    return (
        <div className="grid grid-cols-2 gap-2 p-2 bg-muted/30 rounded-md mt-2">
            {Object.keys(fields).map((key) => (
                <div key={key} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{key}</label>
                    <Input
                        className="h-8 text-xs font-medium"
                        value={value?.[key] || ""}
                        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                        placeholder={`Ingrese ${key}...`}
                    />
                </div>
            ))}
        </div>
    )
}

export function SaleOrderForm({ onSuccess, onConfirmCheckout, initialData, open: openProp, onOpenChange }: SaleOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoMs] = useState<any[]>([])
    const [pricingRules, setPricingRules] = useState<any[]>([])

    const form = useForm<SaleOrderFormValues>({
        resolver: zodResolver(saleOrderSchema) as any,
        defaultValues: initialData ? {
            ...initialData,
            lines: initialData.lines.map((l: any) => ({
                id: l.id,
                product: l.product?.toString() || "",
                description: l.description,
                quantity: parseFloat(l.quantity) || 0,
                uom: l.uom?.toString() || "",
                unit_price: parseFloat(l.unit_price) || 0,
                tax_rate: parseFloat(l.tax_rate) || 19,
                custom_specs: l.custom_specs || {},
                manufacturing_data: l.manufacturing_data || null,
            }))
        } : {
            payment_method: "CREDIT",
            notes: "",
            lines: [{ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19, custom_specs: {}, manufacturing_data: null }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    })


    const fetchData = async () => {
        try {
            const [productsRes, uomsRes, rulesRes] = await Promise.all([
                api.get('/inventory/products/'),
                api.get('/inventory/uoms/'),
                api.get('/inventory/pricing-rules/?active=true')
            ])
            setProducts(productsRes.data.results || productsRes.data)
            setUoMs(uomsRes.data.results || uomsRes.data)
            setPricingRules(rulesRes.data.results || rulesRes.data)
        } catch (error) {
            console.error("Error fetching data:", error)
        }
    }

    const getEffectivePrice = (product: any, qty: number, selectedUomId?: number) => {
        const basePrice = parseFloat(product.sale_price)
        const date = new Date().toISOString().split('T')[0]
        const categoryId = typeof product.category === 'object' ? product.category?.id : product.category

        const applicableRules = pricingRules.filter(rule => {
            const matchesProduct = rule.product === product.id
            const matchesCategory = rule.category === categoryId
            const matchesQty = qty >= parseFloat(rule.min_quantity)
            const matchesUom = !rule.uom || rule.uom === selectedUomId
            const matchesDate = (!rule.start_date || rule.start_date <= date) &&
                (!rule.end_date || rule.end_date >= date)
            return (matchesProduct || matchesCategory) && matchesQty && matchesDate && matchesUom
        }).sort((a, b) => b.priority - a.priority || parseFloat(b.min_quantity) - parseFloat(a.min_quantity))

        if (applicableRules.length > 0) {
            const rule = applicableRules[0]
            if (rule.rule_type === "FIXED") {
                return parseFloat(rule.fixed_price || "0")
            } else {
                return PricingUtils.applyDiscount(basePrice, parseFloat(rule.discount_percentage || "0"))
            }
        }

        // 2. Proportional pricing based on UoM if no rule
        if (selectedUomId && selectedUomId !== product.uom) {
            const baseUom = uoms.find(u => u.id === product.uom)
            const targetUom = uoms.find(u => u.id === selectedUomId)

            if (baseUom && targetUom) {
                return PricingUtils.calculateUoMPrice(
                    basePrice,
                    parseFloat(baseUom.ratio),
                    parseFloat(targetUom.ratio)
                )
            }
        }

        return basePrice
    }

    useEffect(() => {
        if (open) {
            fetchData()
            if (initialData) {
                form.reset({
                    ...initialData,
                    lines: initialData.lines.map((l: any) => ({
                        id: l.id,
                        product: l.product?.toString() || "",
                        description: l.description,
                        quantity: parseFloat(l.quantity) || 0,
                        uom: l.uom?.toString() || "",
                        unit_price: parseFloat(l.unit_price) || 0,
                        tax_rate: parseFloat(l.tax_rate) || 19,
                        custom_specs: l.custom_specs || {},
                        manufacturing_data: l.manufacturing_data || null,
                    }))
                })
            } else {
                form.reset({
                    payment_method: "CREDIT",
                    notes: "",
                    lines: [{ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19, custom_specs: {}, manufacturing_data: null }],
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: SaleOrderFormValues) {
        if (!initialData && onConfirmCheckout) {
            // Enrich data with names for the checkout summary
            const enrichedLines = data.lines.map(line => {
                const product = products.find(p => p.id.toString() === line.product);
                const uom = uoms.find(u => u.id.toString() === line.uom);
                return {
                    ...line,
                    product_name: product?.name || line.description,
                    uom_name: uom?.name || "",
                };
            });
            onConfirmCheckout({ ...data, lines: enrichedLines });
            setOpen(false)
            return
        }

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
                    <DialogTitle>{initialData ? "Editar Nota de Venta" : "Cerrar Venta"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos de la nota de venta." : "Ingrese los detalles para confirmar la venta e ir al checkout."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Líneas de Venta</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19, custom_specs: {}, manufacturing_data: null })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Línea
                                </Button>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[25%]">Producto</TableHead>
                                            <TableHead className="w-[10%]">Cantidad</TableHead>
                                            <TableHead className="w-[10%]">Unidad</TableHead>
                                            <TableHead className="w-[10%]">P. Unit. (Neto)</TableHead>
                                            <TableHead className="w-[10%]">Neto</TableHead>
                                            <TableHead className="w-[10%]">IVA</TableHead>
                                            <TableHead className="w-[10%]">Total</TableHead>
                                            <TableHead className="w-[5%]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((row, index) => (
                                            <TableRow key={row.id}>
                                                <TableCell>
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control}
                                                        name={`lines.${index}.product`}
                                                        render={({ field }) => (
                                                            <div className="space-y-1">
                                                                <div className="flex gap-2 items-start">
                                                                    <div className="flex-1">
                                                                        <ProductSelector
                                                                            value={field.value}
                                                                            restrictStock={true}
                                                                            context="sale"
                                                                            onChange={(value: string | null) => {
                                                                                const selectedProduct = products.find(p => p.id.toString() === value)

                                                                                if (selectedProduct?.product_type === 'CONSUMABLE') {
                                                                                    toast.error("Producto no vendible", {
                                                                                        description: "Los productos consumibles son para uso interno y no pueden venderse directamente."
                                                                                    })
                                                                                    return
                                                                                }

                                                                                field.onChange(value)
                                                                                // Auto-populate price, description and UoM from product
                                                                                if (selectedProduct) {
                                                                                    const qty = form.getValues(`lines.${index}.quantity`) || 1
                                                                                    const uomId = selectedProduct.uom
                                                                                    const price = getEffectivePrice(selectedProduct, qty, uomId)
                                                                                    form.setValue(`lines.${index}.unit_price`, price)
                                                                                    form.setValue(`lines.${index}.description`, selectedProduct.name)
                                                                                    form.setValue(`lines.${index}.uom`, uomId?.toString() || "")

                                                                                    // Reset custom specs if not custom manufacturable
                                                                                    if (selectedProduct.product_type !== 'MANUFACTURABLE_CUSTOM') {
                                                                                        form.setValue(`lines.${index}.custom_specs`, {})
                                                                                    }
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {(() => {
                                                                    const prod = products.find(p => p.id.toString() === field.value)
                                                                    if (!prod) return null

                                                                    return (
                                                                        <div className="space-y-2">
                                                                            {prod.product_type === 'MANUFACTURABLE_CUSTOM' && prod.custom_fields_schema && (
                                                                                <FormField<SaleOrderFormValues>
                                                                                    control={form.control}
                                                                                    name={`lines.${index}.custom_specs`}
                                                                                    render={({ field: specField }) => (
                                                                                        <DynamicFieldsRenderer
                                                                                            schema={prod.custom_fields_schema}
                                                                                            value={specField.value}
                                                                                            onChange={specField.onChange}
                                                                                        />
                                                                                    )}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control}
                                                        name={`lines.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                {...field}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0
                                                                    field.onChange(val)

                                                                    // Re-evaluate price
                                                                    const productId = form.getValues(`lines.${index}.product`)
                                                                    const product = products.find(p => p.id.toString() === productId)
                                                                    if (product) {
                                                                        const uomId = parseInt(form.getValues(`lines.${index}.uom`))
                                                                        const price = getEffectivePrice(product, val, isNaN(uomId) ? undefined : uomId)
                                                                        form.setValue(`lines.${index}.unit_price`, price)
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control}
                                                        name={`lines.${index}.uom`}
                                                        render={({ field }) => {
                                                            const productId = form.watch(`lines.${index}.product`) || ""
                                                            const selectedProduct = products.find(p => p.id.toString() === productId)
                                                            const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1

                                                            return (
                                                                <UoMSelector
                                                                    product={selectedProduct || null}
                                                                    context="sale"
                                                                    value={field.value || ""}
                                                                    onChange={(val) => {
                                                                        field.onChange(val)
                                                                        const qty = Number(form.getValues(`lines.${index}.quantity`)) || 1
                                                                        const uomId = parseInt(val)
                                                                        const price = getEffectivePrice(selectedProduct, qty, isNaN(uomId) ? undefined : uomId)
                                                                        form.setValue(`lines.${index}.unit_price`, price)
                                                                    }}
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
                                                    <FormField<SaleOrderFormValues>
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
                                                <TableCell className="text-right text-muted-foreground text-xs">
                                                    {(Number(form.watch(`lines.${index}.quantity`)) * Number(form.watch(`lines.${index}.unit_price`)) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground text-xs">
                                                    {PricingUtils.calculateTax(Math.round((Number(form.watch(`lines.${index}.quantity`)) * Number(form.watch(`lines.${index}.unit_price`)) || 0))).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-sm">
                                                    {PricingUtils.calculateLineTotal(
                                                        Number(form.watch(`lines.${index}.quantity`)),
                                                        Number(form.watch(`lines.${index}.unit_price`))
                                                    ).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                            disabled={fields.length === 1}
                                                            className="h-8 w-8 text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField<SaleOrderFormValues>
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
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Confirmar Venta"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    )
}
