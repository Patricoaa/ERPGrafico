"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Info,
    Calculator,
    Package,
    Warehouse as WarehouseIcon
} from "lucide-react"

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

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
    const [productDetails, setProductDetails] = useState<any>(null)

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
    const moveType = form.watch("type")
    const quantity = Number(form.watch("quantity") || 0)
    const unitCost = Number(form.watch("unit_cost") || 0)

    // 1. Fetch Warehouses
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const res = await api.get('/inventory/warehouses/')
                const data = res.data.results || res.data
                setWarehouses(Array.isArray(data) ? data : [])
            } catch (err) {
                console.error("Error fetching warehouses", err)
                toast.error("Error al cargar almacenes")
            }
        }
        fetchWarehouses()
    }, [])

    // 2. Fetch Product Details
    useEffect(() => {
        if (selectedProductId) {
            setProductUoMs([]) // Reset UoMs while loading
            api.get(`/inventory/products/${selectedProductId}/`)
                .then(res => {
                    const data = res.data
                    setProductDetails(data)

                    if (data.cost_price !== undefined) {
                        form.setValue("unit_cost", data.cost_price.toString())
                    }

                    // Fetch UoMs using the new uom_category field
                    if (data.uom_category) {
                        return api.get(`/inventory/uoms/?category=${data.uom_category}`)
                            .then(uomRes => {
                                const uoms = uomRes.data.results || uomRes.data
                                setProductUoMs(uoms)

                                // Identify Base UoM
                                const baseId = typeof data.uom === 'object' ? data.uom.id : data.uom
                                const base = uoms.find((u: any) => u.id === baseId)
                                setBaseUoM(base || null)

                                // Auto-select Base UoM if not set
                                if (!form.getValues("uom_id") && base) {
                                    form.setValue("uom_id", base.id.toString())
                                }
                            })
                    }
                })
                .catch(err => {
                    console.error("Error fetching product details", err)
                    toast.error("Error cargando detalles del producto")
                })
        } else {
            setProductUoMs([])
            setBaseUoM(null)
            setProductDetails(null)
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
                uom_id: values.uom_id,
                unit_cost: Number(values.unit_cost),
                adjustment_reason: values.adjustment_reason,
                description: values.description || "Ajuste Manual"
            }

            await api.post('/inventory/moves/adjust/', payload)

            toast.success("Ajuste registrado correctamente")
            form.reset()
            onSuccess?.()

        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al crear ajuste")
        } finally {
            setIsLoading(false)
        }
    }

    // Helper: Calculate Total Value Preview
    const totalValue = quantity * unitCost
    const selectedUoM = productUoMs.find(u => u.id.toString() === selectedUoMId)

    // Helper: Conversion Preview
    const getConversionPreview = () => {
        if (!baseUoM || !selectedUoM) return null
        if (baseUoM.id === selectedUoM.id) return null

        // Ratio logic: Qty Base = Qty * (FromRatio / ToRatio)
        const factor = selectedUoM.ratio / baseUoM.ratio
        const qtyInBase = quantity * factor
        const costInBase = unitCost / factor

        return {
            qty: qtyInBase,
            cost: costInBase,
            factor
        }
    }

    const conversion = getConversionPreview()

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* 1. Transaction Type */}
                <div className="flex justify-center">
                    <Tabs
                        value={moveType}
                        onValueChange={(val) => form.setValue("type", val as "IN" | "OUT")}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-full h-12 p-1 border max-w-md mx-auto">
                            <TabsTrigger
                                value="IN"
                                className="rounded-full transition-all text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-emerald-700 data-[state=active]:border data-[state=active]:border-emerald-200 data-[state=active]:shadow-sm h-full"
                            >
                                <ArrowDownCircle className="mr-2 h-4 w-4" />
                                Entrada de Stock
                            </TabsTrigger>
                            <TabsTrigger
                                value="OUT"
                                className="rounded-full transition-all text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-rose-700 data-[state=active]:border data-[state=active]:border-rose-200 data-[state=active]:shadow-sm h-full"
                            >
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Salida de Stock
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* 2. Context (Product & Warehouse) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-4 rounded-xl border">
                    <FormField
                        control={form.control}
                        name="warehouse_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={cn(FORM_STYLES.label, "flex items-center text-muted-foreground")}>
                                    <WarehouseIcon className="h-4 w-4 mr-2" />
                                    Almacén
                                </FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={cn("bg-background", FORM_STYLES.input)}>
                                            <SelectValue placeholder="Seleccionar ubicación..." />
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

                    <FormField
                        control={form.control}
                        name="product_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={cn(FORM_STYLES.label, "flex items-center text-muted-foreground")}>
                                    <Package className="h-4 w-4 mr-2" />
                                    Producto
                                </FormLabel>
                                <FormControl>
                                    <ProductSelector
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Buscar producto..."
                                        disabled={!!preSelectedProduct}
                                        className="bg-background"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* 3. Quantity & Values */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pt-2 pb-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Detalles del Movimiento</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        {/* Quantity & UoM - 7 cols */}
                        <div className="col-span-12 md:col-span-7 flex gap-2 items-end">
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className={FORM_STYLES.label}>Cantidad</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    className={cn(FORM_STYLES.input, "text-lg font-bold h-10")}
                                                    placeholder="0.00"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="uom_id"
                                render={({ field }) => (
                                    <FormItem className="w-[140px]">
                                        <FormLabel className={FORM_STYLES.label}>Unidad</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={productUoMs.length === 0}
                                        >
                                            <FormControl>
                                                <SelectTrigger className={FORM_STYLES.input}>
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
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Unit Cost - 5 cols */}
                        <div className="col-span-12 md:col-span-5">
                            <FormField
                                control={form.control}
                                name="unit_cost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={cn(FORM_STYLES.label, "flex justify-between")}>
                                            <span>Costo {selectedUoM ? `por ${selectedUoM.name}` : 'Unitario'}</span>
                                            <span className="text-xs font-normal text-muted-foreground">Total: ${totalValue.toFixed(2)}</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input icon="$" type="number" step="0.01" className={cn(FORM_STYLES.input, "text-right font-mono")} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Conversion Alert / Info */}
                    {conversion && baseUoM && (
                        <Alert variant="default" className="bg-blue-50/50 border-blue-100 text-blue-900 py-2">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                            <AlertTitle className="text-xs font-bold text-blue-700 mb-1">Conversión Automática</AlertTitle>
                            <AlertDescription className="text-xs opacity-90">
                                Se registrará como <strong>{conversion.qty.toFixed(4).replace(/\.?0+$/, '')} {baseUoM.name}</strong> a un costo base de <strong>${conversion.cost.toFixed(2)}</strong>.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* 4. Reason & Metadata */}
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Clasificación</span>
                    <div className="flex-1 h-px bg-border" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="adjustment_reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Motivo de Ajuste</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={FORM_STYLES.input}>
                                            <SelectValue />
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

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Notas / Referencia</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: Conteo mensual, Dañado en bodega..." {...field} className={FORM_STYLES.input} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-6 pb-2">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} className="border-primary/20 hover:bg-primary/5 rounded-xl text-xs font-bold">Cancelar</Button>
                    )}
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className={cn("rounded-xl text-xs font-bold", moveType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700')}
                    >
                        {isLoading ? "Procesando..." : (
                            <>
                                {moveType === 'IN' ? "Registrar Entrada" : "Registrar Salida"}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
