"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Minus, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Warehouse {
    id: number
    name: string
}

interface UoM {
    id: number
    name: string
    category: number
    ratio: number
    active: boolean
}

const adjustmentSchema = z.object({
    product_id: z.string().min(1, "Seleccione un producto"),
    warehouse_id: z.string().min(1, "Seleccione un almacén"),
    type: z.enum(["IN", "OUT"]),
    quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Debe ser mayor a 0"),
    uom_id: z.string().optional(),
    unit_cost: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Debe ser mayor o igual a 0"),
    adjustment_reason: z.string().min(1, "Seleccione un motivo"),
    description: z.string().optional(),
})

interface AdjustmentFormProps {
    preSelectedProduct?: string
    preSelectedWarehouse?: string
    onSuccess?: () => void
    onCancel?: () => void
}

export function AdjustmentForm({ preSelectedProduct, preSelectedWarehouse, onSuccess, onCancel }: AdjustmentFormProps) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [productUoMs, setProductUoMs] = useState<UoM[]>([])
    const [baseUoM, setBaseUoM] = useState<UoM | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof adjustmentSchema>>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            type: "IN",
            description: "",
            quantity: "",
            unit_cost: "0",
            adjustment_reason: "CORRECTION",
            product_id: preSelectedProduct || "",
            warehouse_id: preSelectedWarehouse || "",
            uom_id: ""
        }
    })

    const selectedProductId = form.watch("product_id")
    const selectedUoMId = form.watch("uom_id")

    // 1. Fetch Warehouses on mount
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/warehouses/`)
            .then(res => res.json())
            .then(data => setWarehouses(data))
            .catch(err => console.error("Error fetching warehouses", err))
    }, [])

    // 2. Fetch Product Details (UoMs and Cost)
    useEffect(() => {
        if (selectedProductId) {
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/products/${selectedProductId}/`)
                .then(res => res.json())
                .then(data => {
                    // Set default unit cost if available in response
                    if (data.cost_price !== undefined) {
                        form.setValue("unit_cost", data.cost_price.toString())
                    }

                    // Fetch allowed UoMs for this product
                    return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/uoms/?category=${data.uom_category_id}`)
                        .then(r => r.json())
                        .then(uoms => {
                            // data.uom_id is the base definition from product serializer? 
                            // Actually serializer returns uom object or id? 
                            // Assuming standard implementation:
                            setProductUoMs(uoms.results || uoms)

                            if (data.uom) {
                                // Assuming data.uom is the object
                                // or we find it in the list
                                // Actually uoms list is usually enough
                            }

                            // Set Base UoM
                            const base = (uoms.results || uoms).find((u: any) => u.id === data.uom || u.id === data.uom?.id)
                            setBaseUoM(base)

                            // Set default UoM in form
                            if (!form.getValues("uom_id") && data.uom) {
                                const baseId = typeof data.uom === 'object' ? data.uom.id : data.uom
                                form.setValue("uom_id", baseId.toString())
                            }
                        })
                })
                .catch(err => console.error("Error fetching product details", err))
        } else {
            setProductUoMs([])
            setBaseUoM(null)
        }
    }, [selectedProductId, form])


    const onSubmit = async (values: z.infer<typeof adjustmentSchema>) => {
        setIsLoading(true)
        try {
            const qty = Number(values.quantity)
            const finalQty = values.type === 'OUT' ? -qty : qty

            const payload = {
                product_id: values.product_id,
                warehouse_id: values.warehouse_id,
                quantity: finalQty,
                uom_id: values.uom_id, // Send the selected UoM
                unit_cost: Number(values.unit_cost),
                adjustment_reason: values.adjustment_reason,
                description: values.description || "Ajuste Manual"
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/moves/adjust/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Error al crear ajuste")
            }

            toast.success("Ajuste creado exitosamente")
            form.reset()
            onSuccess?.()

        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsLoading(false)
        }
    }

    // Helper to get selected UoM name
    const selectedUoMName = productUoMs.find(u => u.id.toString() === selectedUoMId)?.name || ""

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="product_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Producto</FormLabel>
                            <FormControl>
                                <ProductSelector
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Seleccionar producto..."
                                    disabled={!!preSelectedProduct}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="warehouse_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Almacén</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar almacén..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.id} value={w.id.toString()}>
                                            {w.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Fixed Overlap: Use separate rows or ensure flexbox behavior */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo Movimiento</FormLabel>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={field.value === 'IN' ? 'default' : 'outline'}
                                        className="w-full"
                                        onClick={() => field.onChange('IN')}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Entrada
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={field.value === 'OUT' ? 'destructive' : 'outline'}
                                        className="w-full"
                                        onClick={() => field.onChange('OUT')}
                                    >
                                        <Minus className="mr-2 h-4 w-4" /> Salida
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Cantidad</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {productUoMs.length > 0 && (
                                <FormField
                                    control={form.control}
                                    name="uom_id"
                                    render={({ field }) => (
                                        <FormItem className="w-[120px]">
                                            <FormLabel>Unidad</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="UoM" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {productUoMs.map((u) => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>
                                                            {u.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Visual feedback ensuring user understands what they are doing */}
                {baseUoM && selectedUoMId && baseUoM.id.toString() !== selectedUoMId.toString() && (
                    <Alert variant="default" className="bg-blue-50 text-blue-900 border-blue-200">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            El stock se registrará convertido a la unidad base: <strong>{baseUoM.name}</strong>.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="unit_cost"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Costo {selectedUoMName ? `por ${selectedUoMName}` : 'Unitario'} ($)
                                </FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormDescription className="text-[10px]">
                                    Costo promedio actual se actualizará ponderado.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="adjustment_reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Motivo Especial</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar motivo..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="CORRECTION">Corrección de Inventario</SelectItem>
                                        <SelectItem value="INITIAL">Inventario Inicial</SelectItem>
                                        <SelectItem value="LOSS">Merma / Pérdida</SelectItem>
                                        <SelectItem value="GAIN">Sobrante / Ganancia</SelectItem>
                                        <SelectItem value="REVALUATION">Revalorización</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Motivo / Descripción</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Merma, Conteo inicial..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2 pt-2">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    )}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? "Guardando..." : "Guardar Ajuste"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
