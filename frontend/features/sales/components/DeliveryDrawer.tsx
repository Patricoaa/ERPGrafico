"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { ActionSlideButton, CancelButton, Chip, Drawer, FormFooter, FormSection, LabeledInput, LabeledSelect, PeriodValidationDateInput, StatusBadge } from '@/components/shared'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useSalesOrders } from "../hooks/useSalesOrders"
import { fetchProductStockLevel } from "@/features/inventory/hooks/useStockMoves"
import { toast } from "sonner"
import { Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

import { useServerDate } from "@/hooks/useServerDate"

interface SaleOrderLine {
    id: number
    product: number
    product_name: string
    description: string
    quantity: number
    quantity_delivered: number
    quantity_pending: number
    unit_price: number
    uom_name: string
    product_type: string
    track_inventory: boolean
    manufacturable_quantity: number | null
    requires_advanced_manufacturing: boolean
    is_production_finished?: boolean
    work_order_summary?: {
        status: string
        number: string
    }
}

interface SaleOrder {
    id: number
    number: string
    customer_name: string
    lines: SaleOrderLine[]
    delivery_status: string
}

interface Warehouse {
    id: number
    name: string
    code: string
}

interface StockLevel {
    [productId: number]: number
}

export interface DeliveryFormProps {
    orderId: number
    order: SaleOrder
    warehouses: Warehouse[]
    onSuccess?: () => void
    id?: string
    onLoadingChange?: (loading: boolean) => void
    onCancel?: () => void
    filterType?: 'PRODUCT' | 'SERVICE' | 'ALL'
}

export interface DeliveryDrawerProps extends Omit<DeliveryFormProps, "id" | "onLoadingChange" | "onCancel" | "order" | "warehouses"> {
    open: boolean
    onOpenChange: (open: boolean) => void
    filterType?: 'PRODUCT' | 'SERVICE' | 'ALL'
}

import { useDeliveryData } from "@/features/sales/hooks/useDeliveryData"
export function DeliveryDrawer({ open, onOpenChange, orderId, onSuccess, filterType = 'ALL' }: DeliveryDrawerProps) {
    if (!open || !orderId) return null

    return (
        <DeliveryDrawerInner open={open} onOpenChange={onOpenChange} orderId={orderId} onSuccess={onSuccess} filterType={filterType} />
    )
}

function DeliveryDrawerInner({ open, onOpenChange, orderId, onSuccess, filterType = 'ALL' }: DeliveryDrawerProps) {
    const [loading, setLoading] = useState(false)
    const formId = "modal-delivery-form"
    const { order, warehouses, isLoading } = useDeliveryData(orderId)

    if (isLoading || !order) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange} side="right" defaultSize="65%" title="Cargando despacho..." contentClassName="p-0">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </Drawer>
        )
    }

    const isServiceMode = filterType === 'SERVICE'

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize="65%"
            contentClassName="p-0"
            title={isServiceMode ? "Confirmar Entrega de Servicios" : "Despachar Orden"}
            subtitle={isServiceMode ? "Confirme la entrega de los servicios." : "Ingrese los productos a despachar."}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                            <ActionSlideButton
                                type="submit"
                                form={`${formId}-form`}
                                loading={loading}
                            >
                                {isServiceMode ? 'Confirmar Entrega' : 'Confirmar Despacho'}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <DeliveryForm id={formId} orderId={orderId} order={order} warehouses={warehouses} onSuccess={() => { onOpenChange(false); if (onSuccess) onSuccess(); }} onLoadingChange={setLoading} onCancel={() => onOpenChange(false)} filterType={filterType} />
        </Drawer>
    )
}

const deliverySchema = z.object({
    selectedWarehouse: z.number().nullable(),
    deliveryDate: z.string().min(1, "La fecha de despacho es obligatoria"),
})

type DeliveryFormValues = z.infer<typeof deliverySchema>

export function DeliveryForm({ orderId, order, warehouses, onSuccess, id = "delivery-form", onLoadingChange, onCancel, filterType = 'ALL' }: DeliveryFormProps) {
    const { dateString } = useServerDate()
    const { dispatchOrder, dispatchOrderPartial } = useSalesOrders()

    const form = useForm<DeliveryFormValues>({
        resolver: zodResolver(deliverySchema),
        defaultValues: {
            selectedWarehouse: warehouses.length > 0 ? warehouses[0].id : null,
            deliveryDate: "",
        }
    })

    const [stockLevels, setStockLevels] = useState<StockLevel>({})
    const [deliveryQuantities, setDeliveryQuantities] = useState<{ [lineId: number]: number }>(() => {
        const initial: { [lineId: number]: number } = {}
        order.lines.forEach((line: SaleOrderLine) => {
            initial[line.id] = line.quantity_pending
        })
        return initial
    })
    const [submitting, setSubmitting] = useState(false)
    const [isPartialDispatch, setIsPartialDispatch] = useState(false)
    const isServiceMode = filterType === 'SERVICE'

    const selectedWarehouse = form.watch("selectedWarehouse")
    const deliveryDate = form.watch("deliveryDate")

    const visibleLines = order.lines.filter((line: SaleOrderLine) => {
        if (filterType === 'SERVICE') return line.product_type === 'SERVICE'
        if (filterType === 'PRODUCT') return line.product_type !== 'SERVICE'
        return true
    })

    // Sync delivery date with server date
    useEffect(() => {
        if (dateString && !form.getValues("deliveryDate")) {
            requestAnimationFrame(() => {
                form.setValue("deliveryDate", dateString)
            })
        }
    }, [dateString, form])

    const fetchStockLevels = async () => {
        if (!selectedWarehouse || !order) return

        try {
            const productIds = order.lines.map(line => line.product)
            const stockPromises = productIds.map(async (productId) => {
                try {
                    const stock = await fetchProductStockLevel(productId as number, selectedWarehouse)
                    return { productId, stock }
                } catch {
                    return { productId, stock: 0 }
                }
            })

            const stockResults = await Promise.all(stockPromises)
            const stockMap: StockLevel = {}
            stockResults.forEach(({ productId, stock }) => {
                stockMap[productId as number] = stock
            })
            setStockLevels(stockMap)
        } catch (error) {
            console.error("Error fetching stock levels:", error)
        }
    }

    useEffect(() => {
        if (selectedWarehouse && order) {
            requestAnimationFrame(() => {
                fetchStockLevels()
            })
        }
    }, [selectedWarehouse, order])

    const handleQuantityChange = (lineId: number, value: string) => {
        const numValue = parseFloat(value) || 0
        setDeliveryQuantities(prev => ({
            ...prev,
            [lineId]: numValue
        }))

        const line = order?.lines.find((l: SaleOrderLine) => l.id === lineId)
        if (line && numValue < line.quantity_pending) {
            setIsPartialDispatch(true)
        }
    }

    const onSubmit = async (values: DeliveryFormValues) => {
        if (!isServiceMode && !selectedWarehouse) {
            toast.error("Seleccione una bodega")
            return
        }

        if (!isServiceMode) {
            const insufficientStock = visibleLines.some((line: SaleOrderLine) => {
                const requestedQty = deliveryQuantities[line.id] || 0
                if (requestedQty <= 0) return false

                if (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) {
                    const isFinished = line.is_production_finished
                    if (isFinished) return false
                    return false
                }

                let availableStock = stockLevels[line.product] || 0
                if (!line.track_inventory) {
                    if (line.product_type === 'MANUFACTURABLE') {
                        availableStock = line.manufacturable_quantity ?? 0
                    } else {
                        return false
                    }
                }

                return requestedQty > availableStock
            })

            if (insufficientStock) {
                toast.error("Stock insuficiente para algunos productos")
                return
            }

            const pendingProduction = visibleLines.some((line: SaleOrderLine) => {
                const requestedQty = deliveryQuantities[line.id] || 0
                if (requestedQty <= 0) return false

                const status = getStockStatus(line)
                return status?.type === 'error' && status.message.includes('Producción Pendiente')
            })

            if (pendingProduction) {
                toast.error("No se pueden despachar productos con producción pendiente")
                return
            }
        }

        setSubmitting(true)
        if (onLoadingChange) onLoadingChange(true)
        try {
            const hasPartialQuantities = visibleLines.some((line: SaleOrderLine) => {
                const requestedQty = deliveryQuantities[line.id] || 0
                return requestedQty > 0 && requestedQty < line.quantity_pending
            })

            if (hasPartialQuantities || isPartialDispatch) {
                const lineQuantities: { [key: string]: number } = {}
                visibleLines.forEach((line: SaleOrderLine) => {
                    const qty = deliveryQuantities[line.id]
                    if (qty > 0) {
                        lineQuantities[line.id.toString()] = qty
                    }
                })

                await dispatchOrderPartial({
                    orderId,
                    payload: {
                        warehouse_id: (isServiceMode ? warehouses[0]?.id : selectedWarehouse) as number,
                        delivery_date: deliveryDate,
                        line_quantities: lineQuantities,
                    },
                })
            } else {
                await dispatchOrder({
                    orderId,
                    payload: {
                        warehouse_id: (isServiceMode ? warehouses[0]?.id : selectedWarehouse) as number,
                        delivery_date: deliveryDate,
                    },
                })
            }

            toast.success(isServiceMode ? "Entrega de servicios registrada correctamente" : "Despacho registrado correctamente")
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error dispatching order:", error)
            showApiError(error, isServiceMode ? "Error al registrar la entrega de servicios" : "Error al registrar el despacho")
        } finally {
            setSubmitting(false)
            if (onLoadingChange) onLoadingChange(false)
        }
    }

    const getStockStatus = (line: SaleOrderLine) => {
        const requestedQty = deliveryQuantities[line.id] || 0
        if (requestedQty === 0) return null

        let availableStock = stockLevels[line.product] || 0

        if (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) {
            const isFinished = line.is_production_finished
            if (!isFinished) {
                return {
                    type: 'error',
                    message: 'Producción Pendiente (OT debe estar terminada)',
                    icon: AlertTriangle
                }
            }
        }

        if (line.product_type === 'MANUFACTURABLE' && !line.requires_advanced_manufacturing) {
            availableStock = line.manufacturable_quantity ?? Infinity
            if (requestedQty > availableStock) {
                return {
                    type: 'error',
                    message: `Stock de componentes insuficiente (Máx: ${availableStock})`,
                    icon: AlertTriangle
                }
            }
        }

        if (line.product_type === 'STORABLE' && line.track_inventory) {
            if (requestedQty > availableStock) {
                return {
                    type: 'error',
                    message: `Stock insuficiente (${availableStock} disponibles)`,
                    icon: AlertTriangle
                }
            }
        }

        if (requestedQty === line.quantity_pending) {
            return { type: 'success', message: 'Despacho completo', icon: CheckCircle2 }
        }
        return { type: 'warning', message: 'Despacho parcial', icon: AlertTriangle }
    }

    const canSubmit = (isServiceMode || selectedWarehouse) && !visibleLines.some((line: SaleOrderLine) => { const qty = deliveryQuantities[line.id] || 0; if (qty <= 0) return false; const status = getStockStatus(line); return status?.type === 'error'; });

    return (
        <div id={id} className="space-y-4">
            <form id={`${id}-form`} onSubmit={form.handleSubmit(onSubmit)} className="hidden">
                <input type="hidden" {...form.register("selectedWarehouse")} />
                <input type="hidden" {...form.register("deliveryDate")} />
            </form>
            <div className="space-y-4">
                <FormSection title={isServiceMode ? "Configuración de Entrega de Servicios" : "Configuración de Entrega"} icon={Package} />
                <div className={isServiceMode ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                    {!isServiceMode && (
                        <LabeledSelect
                            label="Bodega de Despacho"
                            value={selectedWarehouse?.toString() || ''}
                            onChange={(val) => form.setValue("selectedWarehouse", Number(val))}
                            placeholder="Seleccione bodega"
                            options={warehouses.map((warehouse: Warehouse) => ({
                                value: warehouse.id.toString(),
                                label: `${warehouse.name} (${warehouse.code})`,
                            }))}
                        />
                    )}

                    <PeriodValidationDateInput
                        label={isServiceMode ? "Fecha de Entrega" : "Fecha de Despacho"}
                        date={deliveryDate ? new Date(deliveryDate + 'T12:00:00') : undefined}
                        onDateChange={(d) => {
                            if (!d) {
                                form.setValue("deliveryDate", "")
                                return
                            }
                            form.setValue("deliveryDate", d.toISOString().split('T')[0])
                        }}
                        validationType="accounting"
                        required
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Estado de {isServiceMode ? 'Entrega' : 'Despacho'}:</span>
                    <StatusBadge
                        status={
                            order?.delivery_status === 'DELIVERED' ? 'delivered' :
                                order?.delivery_status === 'PARTIAL' ? 'partial' :
                                    'pending'
                        }
                        size="md"
                    />
                </div>

                <FormSection title={isServiceMode ? "Detalle de Servicios" : "Detalle de Productos"} icon={Package} />
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Unidad</TableHead>
                                <TableHead className="text-center">Pendiente</TableHead>
                                {!isServiceMode && <TableHead className="text-center">Stock</TableHead>}
                                <TableHead className="text-center">{isServiceMode ? 'A Entregar' : 'A Despachar'}</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleLines.map((line: SaleOrderLine) => {
                                const stockStatus = getStockStatus(line)
                                const availableStock = stockLevels[line.product] || 0

                                return (
                                    <TableRow key={line.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{line.product_name}</div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{line.description}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/30">
                                                {line.uom_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-xs font-black">{line.quantity_pending}</span>
                                        </TableCell>
                                        {!isServiceMode && (
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    {line.track_inventory && (
                                                        <span className={cn(
                                                            "text-xs font-black",
                                                            availableStock >= line.quantity_pending ? "text-success" : "text-destructive"
                                                        )}>
                                                            {availableStock}
                                                        </span>
                                                    )}

                                                    {line.product_type === 'MANUFACTURABLE' && (
                                                        <>
                                                            {!line.track_inventory && (
                                                                <Chip size="xs" intent="primary">
                                                                    {line.requires_advanced_manufacturing ? 'Fabricación Avanzada' : 'Fabricable'}
                                                                </Chip>
                                                            )}

                                                            {line.work_order_summary ? (
                                                                <div className="flex flex-col items-center mt-1">
                                                                    <StatusBadge
                                                                        status={line.work_order_summary.status.toLowerCase()}
                                                                        size="sm"
                                                                    />
                                                                    <span className="text-[9px] text-muted-foreground mt-0.5">{line.work_order_summary.number}</span>
                                                                </div>
                                                            ) : !line.requires_advanced_manufacturing && !line.track_inventory ? (
                                                                <span className={cn(
                                                                    "text-[10px] font-black",
                                                                    (line.manufacturable_quantity ?? 0) >= line.quantity_pending ? "text-success" : "text-destructive"
                                                                )}>
                                                                    {line.manufacturable_quantity ?? 0}
                                                                </span>
                                                            ) : line.requires_advanced_manufacturing ? (
                                                                <span className="text-[9px] text-destructive">Sin OT registrada</span>
                                                            ) : null}
                                                        </>
                                                    )}

                                                    {!line.track_inventory && line.product_type !== 'MANUFACTURABLE' && !isServiceMode && (
                                                        <Chip size="xs" intent="success">Disponible</Chip>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <LabeledInput
                                                type="number"
                                                min="0"
                                                max={line.quantity_pending}
                                                step="0.01"
                                                value={deliveryQuantities[line.id] || 0}
                                                onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                                                className="w-24 text-center mx-auto h-8 font-bold"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {stockStatus && (
                                                <div className="flex items-center gap-1 text-xs">
                                                    {stockStatus.type === 'error' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                                    {stockStatus.type === 'success' && <CheckCircle2 className="h-3 w-3 text-success" />}
                                                    <span className={
                                                        stockStatus.type === 'error' ? 'text-destructive' :
                                                            stockStatus.type === 'success' ? 'text-success' :
                                                                'text-warning'
                                                    }>
                                                        {stockStatus.message}
                                                    </span>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                {isPartialDispatch && (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            Se realizará un despacho parcial. Podrás crear despachos adicionales para las cantidades restantes.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    )
}

export default DeliveryDrawer
