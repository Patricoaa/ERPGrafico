"use client"

import { showApiError } from "@/lib/errors"
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
    partner_contact_id: z.string().optional(),
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
    const [partners, setPartners] = useState<{ id: number, name: string }[]>([])

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
            uom_id: "",
            partner_contact_id: ""
        }
    })

    const selectedProductId = form.watch("product_id")
    const selectedUoMId = form.watch("uom_id")
    const moveType = form.watch("type")
    const adjustmentReason = form.watch("adjustment_reason")
    const quantity = Number(form.watch("quantity") || 0)
    const unitCost = Number(form.watch("unit_cost") || 0)

    const isPartnerReason = adjustmentReason === 'PARTNER_CONTRIBUTION' || adjustmentReason === 'PARTNER_WITHDRAWAL'

    // 1. Fetch Warehouses
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const [whRes, partnersRes] = await Promise.all([
                    api.get('/inventory/warehouses/'),
                    api.get('/contacts/partners/')
                ])
                const whData = whRes.data.results || whRes.data
                setWarehouses(Array.isArray(whData) ? whData : [])
                setPartners(Array.isArray(partnersRes.data) ? partnersRes.data : [])
            } catch (err) {
                console.error("Error fetching data", err)
                toast.error("Error al cargar datos")
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

            const payload: any = {
                product_id: values.product_id,
                warehouse_id: values.warehouse_id,
                quantity: finalQty,
                uom_id: values.uom_id,
                unit_cost: Number(values.unit_cost),
                adjustment_reason: values.adjustment_reason,
                description: values.description || "Ajuste Manual"
            }

            // Include partner_contact_id for partner-related reasons
            if (values.partner_contact_id && (values.adjustment_reason === 'PARTNER_CONTRIBUTION' || values.adjustment_reason === 'PARTNER_WITHDRAWAL')) {
                payload.partner_contact_id = values.partner_contact_id
            }

            await api.post('/inventory/moves/adjust/', payload)

            toast.success("Ajuste registrado correctamente")
            form.reset()
            onSuccess?.()

        } catch (error: unknown) {
            console.error(error)
            showApiError(error, "Error al crear ajuste")
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
                                className="rounded-full transition-all text-[11px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-emerald-700 data-[state=active]:border data-[state=active]:border-emerald-200 data-[state=active]:shadow-sm h-full"
                            >
                                <ArrowDownCircle className="mr-2 h-4 w-4" />
                                Entrada de Stock
                            </TabsTrigger>
                            <TabsTrigger
                                value="OUT"
                                className="rounded-full transition-all text-[11px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-rose-700 data-[state=active]:border data-[state=active]:border-rose-200 data-[state=active]:shadow-sm h-full"
                            >
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Salida de Stock
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* 2. Structured Layout as Requested */}


                {/* Section: Clasification */}
                <div className="flex items-center gap-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Clasificación</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Row 1: Motivo | Socio | Notas */}
                <div className={cn("grid grid-cols-1 gap-6", isPartnerReason ? "md:grid-cols-3" : "md:grid-cols-[1fr_2fr]")}>
                    <FormField
                        control={form.control}
                        name="adjustment_reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Motivo de Ajuste</FormLabel>
                                <Select onValueChange={(val) => {
                                    field.onChange(val)
                                    if (val !== 'PARTNER_CONTRIBUTION' && val !== 'PARTNER_WITHDRAWAL') {
                                        form.setValue('partner_contact_id', '')
                                    }
                                    if (val === 'PARTNER_CONTRIBUTION') form.setValue('type', 'IN')
                                    if (val === 'PARTNER_WITHDRAWAL') form.setValue('type', 'OUT')
                                }} defaultValue={field.value} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={FORM_STYLES.input}>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="CORRECTION">Corrección de Inventario</SelectItem>
                                        {moveType === 'OUT' && <SelectItem value="LOSS">Merma / Pérdida</SelectItem>}
                                        {moveType === 'IN' && <SelectItem value="GAIN">Sobrante / Ganancia</SelectItem>}
                                        <SelectItem value="REVALUATION">Revalorización</SelectItem>
                                        {moveType === 'IN' && <SelectItem value="PARTNER_CONTRIBUTION">Aporte de Socio</SelectItem>}
                                        {moveType === 'OUT' && <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {isPartnerReason && (
                        <FormField
                            control={form.control}
                            name="partner_contact_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Socio *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className={cn(FORM_STYLES.input, "border-amber-200 bg-amber-50/30")}>
                                                <SelectValue placeholder="Seleccione un socio" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {partners.map(p => (
                                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Notas / Referencia</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: Ajuste mensual, retiro..." {...field} className={FORM_STYLES.input} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Section: Detalles del Movimiento */}
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Detalles del Movimiento</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Row 2: Almacén | Producto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                        allowedTypes={["STORABLE", "MANUFACTURABLE"]}
                                        simpleOnly={true}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Row 3: Cantidad | Unidad | Costo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Cantidad</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className={cn(FORM_STYLES.input, "text-right font-mono")}
                                        placeholder="0.00"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="uom_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Unidad de Medida</FormLabel>
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

                    <FormField
                        control={form.control}
                        name="unit_cost"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={cn(FORM_STYLES.label, "flex justify-between")}>
                                    <span>Costo Unitario</span>
                                    <span className="text-[10px] font-normal text-muted-foreground mr-1">Total: ${totalValue.toFixed(2)}</span>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        icon="$"
                                        type={moveType === 'IN' ? "number" : "text"}
                                        step={moveType === 'IN' ? "0.01" : undefined}
                                        readOnly={moveType === 'OUT'}
                                        className={cn(FORM_STYLES.input, "text-right font-mono", moveType === 'OUT' && "opacity-80 bg-muted/50 cursor-default")}
                                        {...field}
                                        value={moveType === 'OUT' ? Number(field.value).toFixed(2) : field.value}
                                        onChange={(e) => moveType === 'IN' && field.onChange(e)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Conversion Alert / Info */}
                {conversion && baseUoM && (
                    <Alert variant="default" className="bg-blue-50/50 border-blue-100 text-blue-900 py-2">
                        <Info className="h-4 w-4 text-primary mt-0.5" />
                        <AlertTitle className="text-xs font-bold text-primary mb-1">Conversión Automática</AlertTitle>
                        <AlertDescription className="text-xs opacity-90">
                            Se registrará como <strong>{conversion.qty.toFixed(4).replace(/\.?0+$/, '')} {baseUoM.name}</strong> a un costo base de <strong>${conversion.cost.toFixed(2)}</strong>.
                        </AlertDescription>
                    </Alert>
                )}


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
