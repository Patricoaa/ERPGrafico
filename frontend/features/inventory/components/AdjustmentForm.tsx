"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Warehouse as WarehouseIcon,
    ShieldAlert,
    ArrowDownCircle,
    ArrowUpCircle,
    Info
} from "lucide-react"

import { CancelButton } from "@/components/shared/ActionButtons"

import {
    Form,
    FormField
} from "@/components/ui/form"
import { toast } from "sonner"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import api from "@/lib/api"
import { Product, UoM, Warehouse } from "@/types/entities"
import { cn } from "@/lib/utils"
import { validateAccountingPeriod } from '@/features/accounting/actions'
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput, LabeledSelect, FormTabs, type FormTabItem, FormFooter, SubmitButton } from "@/components/shared"
import { FormSection } from "@/components/shared/FormSection"


const adjustmentSchema = z.object({
    product_id: z.string().min(1, "Seleccione un producto"),
    warehouse_id: z.string().min(1, "Seleccione un almacén"),
    type: z.enum(["IN", "OUT"]),
    quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Debe ser mayor a 0"),
    uom_id: z.string().optional(),
    unit_cost: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Debe ser mayor o igual a 0"),
    total_cost: z.string().optional(),
    adjustment_reason: z.string().min(1, "Seleccione un motivo"),
    description: z.string().optional(),
    partner_contact_id: z.string().optional(),
}).refine((data) => {
    if ((data.adjustment_reason === 'PARTNER_CONTRIBUTION' || data.adjustment_reason === 'PARTNER_WITHDRAWAL') && !data.partner_contact_id) {
        return false;
    }
    return true;
}, {
    message: "El socio es obligatorio para este motivo",
    path: ["partner_contact_id"]
})

interface AdjustmentFormProps {
    preSelectedProduct?: string
    preSelectedWarehouse?: string
    onSuccess?: () => void
    onCancel?: () => void
    onLoadingChange?: (loading: boolean) => void
}

interface StockMovePayload {
    product_id: string;
    warehouse_id: string;
    quantity: number;
    uom_id?: string;
    unit_cost: number;
    adjustment_reason: string;
    description: string;
    partner_contact_id?: string;
}

export function AdjustmentForm({ 
    preSelectedProduct, 
    preSelectedWarehouse, 
    onSuccess, 
    onCancel,
    onLoadingChange 
}: AdjustmentFormProps) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [productUoMs, setProductUoMs] = useState<UoM[]>([])
    const [baseUoM, setBaseUoM] = useState<UoM | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        onLoadingChange?.(isLoading)
    }, [isLoading, onLoadingChange])
    const [productDetails, setProductDetails] = useState<Product | null>(null)
    const [partners, setPartners] = useState<{ id: number, name: string }[]>([])
    const [periodStatus, setPeriodStatus] = useState<{ is_closed: boolean; period_name?: string; date?: string; error?: string } | null>(null)

    const form = useForm<z.infer<typeof adjustmentSchema>>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            type: "IN",
            description: "",
            quantity: "",
            unit_cost: "0.00",
            total_cost: "0.00",
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
    const totalCostWatch = Number(form.watch("total_cost") || 0)

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
                showApiError(err, "Error al cargar datos")
            }
        }
        fetchWarehouses()
    }, [])

    // Check period status for today
    useEffect(() => {
        const checkPeriod = async () => {
            const today = new Date().toISOString().split('T')[0]
            const status = await validateAccountingPeriod(today)
            setPeriodStatus(status)
        }
        checkPeriod()
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
                                const base = uoms.find((u: UoM) => u.id === baseId)
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
                    showApiError(err, "Error cargando detalles del producto")
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
            // Check period closure
            const today = new Date().toISOString().split('T')[0]
            const status = await validateAccountingPeriod(today)
            if (status.is_closed) {
                toast.error(`No se puede registrar el ajuste: El periodo ${(status as any).period_name || ''} está cerrado.`, {
                    icon: <ShieldAlert className="h-4 w-4 text-destructive" />
                })
                setIsLoading(false)
                return
            }

            const qty = Number(values.quantity)
            const finalQty = values.type === 'OUT' ? -qty : qty

            const payload: StockMovePayload = {
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

    const tabItems: FormTabItem[] = [
        {
            value: "IN",
            label: "Entrada",
            icon: ArrowDownCircle,
        },
        {
            value: "OUT",
            label: "Salida",
            icon: ArrowUpCircle,
        },
    ]

    return (
        <Form {...form}>
            <form id="adjustment-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 space-y-0">

                {periodStatus?.is_closed && (
                    <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive py-2 mb-2">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle className="text-xs font-bold mb-1">Periodo Cerrado</AlertTitle>
                        <AlertDescription className="text-xs opacity-90">
                            El periodo contable actual (<strong>{periodStatus.period_name}</strong>) está cerrado. No podrá guardar este ajuste.
                        </AlertDescription>
                    </Alert>
                )}

                <FormTabs
                    items={tabItems}
                    value={moveType}
                    onValueChange={(val) => form.setValue("type", val as "IN" | "OUT")}
                    orientation="horizontal"
                    listClassName={cn(
                        moveType === 'IN' 
                            ? "[&_[data-state=active]]:text-success [&_[data-state=active]]:bg-success/5 [&_[data-state=active]]:border-success/20" 
                            : "[&_[data-state=active]]:text-destructive [&_[data-state=active]]:bg-destructive/5 [&_[data-state=active]]:border-destructive/20"
                    )}
                    className="flex-1 flex flex-col min-h-0"
                    headerClassName="bg-transparent"
                    pillClassName="bg-transparent border-none"
                    contentClassName="flex-1 flex flex-col overflow-hidden bg-background"
                >
                    <div className="flex-1 overflow-y-auto space-y-8 pt-6 px-8 pb-8 scrollbar-thin">
                        <FormSection title="Clasificación y Origen" icon={Info} />

                        <div className="grid grid-cols-4 gap-6">
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="adjustment_reason"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Motivo de Ajuste"
                                            required
                                            value={field.value}
                                            onChange={(val) => {
                                                field.onChange(val)
                                                if (val !== 'PARTNER_CONTRIBUTION' && val !== 'PARTNER_WITHDRAWAL') {
                                                    form.setValue('partner_contact_id', '')
                                                }
                                                if (val === 'PARTNER_CONTRIBUTION') form.setValue('type', 'IN')
                                                if (val === 'PARTNER_WITHDRAWAL') form.setValue('type', 'OUT')
                                            }}
                                            error={fieldState.error?.message}
                                            options={[
                                                { value: "CORRECTION", label: "Corrección de Inventario" },
                                                ...(moveType === 'OUT' ? [{ value: "LOSS", label: "Merma / Pérdida" }] : []),
                                                ...(moveType === 'IN' ? [{ value: "GAIN", label: "Sobrante / Ganancia" }] : []),
                                                { value: "REVALUATION", label: "Revalorización" },
                                                ...(moveType === 'IN' ? [{ value: "PARTNER_CONTRIBUTION", label: "Aporte de Socio" }] : []),
                                                ...(moveType === 'OUT' ? [{ value: "PARTNER_WITHDRAWAL", label: "Retiro de Socio" }] : []),
                                            ]}
                                        />
                                    )}
                                />
                            </div>

                            <div className="col-span-2">
                                {isPartnerReason ? (
                                    <FormField
                                        control={form.control}
                                        name="partner_contact_id"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Socio del Movimiento"
                                                required
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Seleccione un socio..."
                                                className="border-warning/20 bg-warning/5"
                                                error={fieldState.error?.message}
                                                options={partners.map(p => ({
                                                    value: p.id.toString(),
                                                    label: p.name
                                                }))}
                                            />
                                        )}
                                    />
                                ) : (
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Notas / Referencia Interna"
                                                placeholder="Ej: Ajuste mensual detectado en conteo..."
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                )}
                            </div>

                            {isPartnerReason && (
                                <div className="col-span-4">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Referencia"
                                                placeholder="Notas del socio..."
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <FormSection title="Detalles del Movimiento" icon={WarehouseIcon} />

                        <div className="space-y-6">
                            {/* Row 1: Almacén | Producto */}
                            <div className="grid grid-cols-4 gap-6">
                                <div className="col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="warehouse_id"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Almacén de Ubicación"
                                                required
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Seleccionar ubicación..."
                                                error={fieldState.error?.message}
                                                options={warehouses.map(w => ({
                                                    value: w.id.toString(),
                                                    label: w.name
                                                }))}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="product_id"
                                        render={({ field, fieldState }) => (
                                            <ProductSelector
                                                label="Producto a Ajustar"
                                                required
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Buscar producto por SKU o Nombre..."
                                                disabled={!!preSelectedProduct}
                                                allowedTypes={["STORABLE", "MANUFACTURABLE"]}
                                                simpleOnly={true}
                                                error={fieldState.error?.message}
                                            />
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Cantidad | Unidad | Costo */}
                            <div className="grid grid-cols-4 gap-6">
                                <div className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="quantity"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Cantidad"
                                                required
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                error={fieldState.error?.message}
                                                {...field}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    field.onChange(val);
                                                    if (moveType === 'IN') {
                                                        const q = Number(val) || 0;
                                                        const u = Number(form.getValues("unit_cost")) || 0;
                                                        form.setValue("total_cost", Math.ceil(q * u).toString());
                                                    }
                                                }}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="uom_id"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Unidad de Medida"
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="UoM"
                                                disabled={productUoMs.length === 0}
                                                error={fieldState.error?.message}
                                                options={productUoMs.map(u => ({
                                                    value: u.id.toString(),
                                                    label: u.name
                                                }))}
                                            />
                                        )}
                                    />
                                </div>

                                 <div className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="unit_cost"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                {...field}
                                                label="Unitario"
                                                required
                                                type={moveType === 'IN' ? "number" : "text"}
                                                step={moveType === 'IN' ? "1" : undefined}
                                                disabled={moveType === 'OUT'}
                                                placeholder="0"
                                                icon="$"
                                                error={fieldState.error?.message}
                                                value={moveType === 'OUT' ? Math.ceil(Number(field.value)).toString() : field.value}
                                                onChange={(e) => {
                                                    if (moveType === 'OUT') return;
                                                    const val = e.target.value;
                                                    field.onChange(val);
                                                    const u = Number(val) || 0;
                                                    const q = Number(form.getValues("quantity")) || 0;
                                                    form.setValue("total_cost", Math.ceil(u * q).toString());
                                                }}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="total_cost"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                {...field}
                                                label="Total"
                                                type={moveType === 'IN' ? "number" : "text"}
                                                step={moveType === 'IN' ? "1" : undefined}
                                                disabled={moveType === 'OUT'}
                                                placeholder="0"
                                                icon="$"
                                                error={fieldState.error?.message}
                                                value={moveType === 'OUT' ? Math.ceil(quantity * unitCost).toString() : field.value}
                                                onChange={(e) => {
                                                    if (moveType === 'OUT') return;
                                                    const val = e.target.value;
                                                    field.onChange(val);
                                                    const t = Number(val) || 0;
                                                    const q = Number(form.getValues("quantity")) || 0;
                                                    if (q > 0) {
                                                        form.setValue("unit_cost", Math.ceil(t / q).toString());
                                                    }
                                                }}
                                            />
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Conversion Alert / Info */}
                            {conversion && baseUoM && (
                                <Alert className="bg-primary/5 border-primary/20 animate-in slide-in-from-top-2 duration-300">
                                    <Info className="h-4 w-4 text-primary" />
                                    <AlertTitle className="text-[10px] font-bold uppercase text-primary mb-0.5">Conversión Automática</AlertTitle>
                                    <AlertDescription className="text-[11px] leading-tight">
                                        Se registrará como <span className="font-black">{conversion.qty.toFixed(4).replace(/\.?0+$/, '')} {baseUoM.name}</span> a un costo base de <span className="font-black">${conversion.cost.toFixed(2)}</span>.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                    </div>
                </FormTabs>
            </form>
        </Form>
    )
}
