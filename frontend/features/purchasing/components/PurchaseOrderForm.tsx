"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PurchaseOrderInitialData, PurchaseOrderLine } from "@/types/forms"
import { ProductMinimal, UoM } from "@/types/entities"
import * as z from "zod"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { BaseModal, ActionSlideButton, MoneyDisplay, LabeledInput } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
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
    initialData?: PurchaseOrderInitialData
    open?: boolean
    onOpenChange?: (open: boolean) => void
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
        <div className="space-y-1 text-right pt-4 border-t flex flex-col items-end">
            <div className="text-sm text-muted-foreground flex gap-1">
                <span>Subtotal:</span>
                <MoneyDisplay amount={subtotal} inline />
            </div>
            <div className="text-sm text-muted-foreground flex gap-1">
                <span>IVA (19%):</span>
                <MoneyDisplay amount={tax} inline />
            </div>
            <div className="text-lg font-bold flex gap-1">
                <span>Total:</span>
                <MoneyDisplay amount={total} inline />
            </div>
        </div>
    )
}

export function PurchaseOrderForm({ onSuccess, initialData, open: openProp, onOpenChange }: PurchaseOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<ProductMinimal[]>([])
    const [uoms, setUoMs] = useState<UoM[]>([])

    const form = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderSchema),
        defaultValues: initialData ? {
            ...initialData,
            lines: initialData.lines.map((l: PurchaseOrderLine) => {
                const productId = typeof l.product === 'object' && l.product !== null ? l.product.id : l.product;
                return {
                    id: l.id,
                    product: productId?.toString() || "",
                    quantity: typeof l.quantity === 'string' ? parseFloat(l.quantity) : (l.quantity || 0),
                    uom: l.uom?.toString() || "",
                    unit_cost: typeof l.unit_cost === 'string' ? parseFloat(l.unit_cost) : (l.unit_cost || 0),
                    tax_rate: typeof l.tax_rate === 'string' ? parseFloat(l.tax_rate) : (l.tax_rate || 19),
                }
            })
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
                api.get('/inventory/products/?can_be_purchased=true'),
                api.get('/inventory/uoms/'),
            ])

            const allProducts = productsRes.data.results || productsRes.data
            setProducts(allProducts)
            setUoMs(uomsRes.data.results || uomsRes.data)
        } catch (error) {
            console.error("Error fetching data:", error)
        }
    }



    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            fetchData()
            if (initialData) {
                form.reset({
                    ...initialData,
                    lines: initialData.lines.map((l: PurchaseOrderLine) => {
                        const productId = typeof l.product === 'object' && l.product !== null ? l.product.id : l.product;
                        return {
                            id: l.id,
                            product: productId?.toString() || "",
                            quantity: typeof l.quantity === 'string' ? parseFloat(l.quantity) : (l.quantity || 0),
                            uom: l.uom?.toString() || "",
                            unit_cost: typeof l.unit_cost === 'string' ? parseFloat(l.unit_cost) : (l.unit_cost || 0),
                            tax_rate: typeof l.tax_rate === 'string' ? parseFloat(l.tax_rate) : (l.tax_rate || 19),
                        }
                    })
                })
            } else {
                form.reset({
                    notes: "",
                    lines: [{ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }],
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, initialData, form])

    async function onSubmit(data: PurchaseOrderFormValues) {
        if (!initialData) {
            toast.error("Este formulario solo se usa para editar órdenes existentes")
            return
        }

        setLoading(true)
        try {
            await api.put(`/purchasing/orders/${initialData.id}/`, data)
            toast.success("Orden de Compra actualizada correctamente")
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            console.error("Error saving purchase order:", error)
            showApiError(error, "Error al guardar la Orden de Compra")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={setOpen}
            size="xl"
            title="Editar Orden de Compra"
            description="Modifique los datos de la orden de compra."
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        Cancelar
                    </Button>
                    <ActionSlideButton type="submit" form="purchase-order-form" disabled={loading}>
                        {loading ? "Guardando..." : "Guardar Cambios"}
                    </ActionSlideButton>
                </>
            }
        >
            <Form {...form}>
                <form id="purchase-order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Líneas de Compra</h3>
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

                        <div className="rounded-lg border border-dashed">
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
                                                                context="purchase"
                                                                excludeVariantTemplates={true}
                                                                onChange={(val) => {
                                                                    field.onChange(val)
                                                                    // Automatically set unit_cost and UoM if product selected
                                                                    if (val) {
                                                                        const prod = products.find(p => p.id.toString() === val)
                                                                        if (prod) {
                                                                            form.setValue(`lines.${index}.unit_cost`, parseFloat(String(prod.last_purchase_price || 0)) || 0)
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
                                                        <LabeledInput
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
                                                                product={(selectedProduct || null) as any}
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
                                                        <LabeledInput
                                                            type="number"
                                                            step="1"
                                                            {...field}
                                                            onChange={(e) => field.onChange(Math.ceil(parseFloat(e.target.value) || 0))}
                                                        />
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                <MoneyDisplay amount={Number(form.watch(`lines.${index}.quantity`)) * Number(form.watch(`lines.${index}.unit_cost`)) || 0} />
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
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Notas / Observaciones"
                                    as="textarea"
                                    placeholder="Notas adicionales..."
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                        <OrderTotals control={form.control} />
                    </div>
                </form>
            </Form>
        </BaseModal>
    )
}
