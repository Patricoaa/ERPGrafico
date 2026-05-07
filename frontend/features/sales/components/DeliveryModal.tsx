"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { LabeledInput, LabeledSelect, PeriodValidationDateInput, FormSection, FormFooter, SubmitButton, CancelButton } from "@/components/shared"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import api from "@/lib/api"
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

interface DeliveryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    onSuccess?: () => void
}

import { useDeliveryData } from "@/features/sales/hooks/useDeliveryData"
import { Suspense } from "react"

export function DeliveryModal({ open, onOpenChange, orderId, onSuccess }: DeliveryModalProps) {
    if (!open || !orderId) return null

    return (
        <Suspense fallback={
            <BaseModal open={open} onOpenChange={onOpenChange} size="xl" title="Cargando despacho...">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </BaseModal>
        }>
            <DeliveryModalInner open={open} onOpenChange={onOpenChange} orderId={orderId} onSuccess={onSuccess} />
        </Suspense>
    )
}

function DeliveryModalInner({ open, onOpenChange, orderId, onSuccess }: DeliveryModalProps) {
    const { dateString } = useServerDate()
    const { order, warehouses } = useDeliveryData(orderId)

    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(
        warehouses.length > 0 ? warehouses[0].id : null
    )
    const [stockLevels, setStockLevels] = useState<StockLevel>({})
    const [deliveryQuantities, setDeliveryQuantities] = useState<{ [lineId: number]: number }>(() => {
        const initial: { [lineId: number]: number } = {}
        order.lines.forEach((line: SaleOrderLine) => {
            initial[line.id] = line.quantity_pending
        })
        return initial
    })
    const [deliveryDate, setDeliveryDate] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [isPartialDispatch, setIsPartialDispatch] = useState(false)

    // Sync delivery date with server date
    useEffect(() => {
        if (dateString && !deliveryDate) {
            setDeliveryDate(dateString)
        }
    }, [dateString])

    useEffect(() => {
        if (selectedWarehouse && order) {
            fetchStockLevels()
        }
    }, [selectedWarehouse, order])

    const fetchStockLevels = async () => {
        if (!selectedWarehouse || !order) return

        try {
            const productIds = order.lines.map(line => line.product)
            const stockPromises = productIds.map(async (productId) => {
                try {
                    const response = await api.get(`/inventory/moves/?product_id=${productId}&warehouse_id=${selectedWarehouse}`)
                    const moves = response.data.results || response.data
                    const totalStock = moves.reduce((sum: number, move: { quantity?: string | number }) => sum + parseFloat(String(move.quantity || 0)), 0)
                    return { productId, stock: totalStock }
                } catch (error) {
                    return { productId, stock: 0 }
                }
            })

            const stockResults = await Promise.all(stockPromises)
            const stockMap: StockLevel = {}
            stockResults.forEach(({ productId, stock }) => {
                stockMap[productId] = stock
            })
            setStockLevels(stockMap)
        } catch (error) {
            console.error("Error fetching stock levels:", error)
        }
    }

    const handleQuantityChange = (lineId: number, value: string) => {
        const numValue = parseFloat(value) || 0
        setDeliveryQuantities(prev => ({
            ...prev,
            [lineId]: numValue
        }))

        const line = order?.lines.find((l: any) => l.id === lineId)
        if (line && numValue < line.quantity_pending) {
            setIsPartialDispatch(true)
        }
    }

    const handleDispatch = async () => {
        if (!selectedWarehouse) {
            toast.error("Seleccione una bodega")
            return
        }

        const insufficientStock = order?.lines.some((line: any) => {
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

        const pendingProduction = order?.lines.some((line: any) => {
            const requestedQty = deliveryQuantities[line.id] || 0
            if (requestedQty <= 0) return false

            const status = getStockStatus(line)
            return status?.type === 'error' && status.message.includes('Producción Pendiente')
        })

        if (pendingProduction) {
            toast.error("No se pueden despachar productos con producción pendiente")
            return
        }

        setSubmitting(true)
        try {
            const hasPartialQuantities = order?.lines.some((line: any) => {
                const requestedQty = deliveryQuantities[line.id] || 0
                return requestedQty > 0 && requestedQty < line.quantity_pending
            })

            if (hasPartialQuantities || isPartialDispatch) {
                const lineQuantities: { [key: string]: number } = {}
                order?.lines.forEach((line: any) => {
                    const qty = deliveryQuantities[line.id]
                    if (qty > 0) {
                        lineQuantities[line.id.toString()] = qty
                    }
                })

                await api.post(`/sales/orders/${orderId}/partial_dispatch/`, {
                    warehouse_id: selectedWarehouse,
                    delivery_date: deliveryDate,
                    line_quantities: lineQuantities
                })
            } else {
                await api.post(`/sales/orders/${orderId}/dispatch/`, {
                    warehouse_id: selectedWarehouse,
                    delivery_date: deliveryDate
                })
            }

            toast.success("Despacho registrado correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error dispatching order:", error)
            showApiError(error, "Error al registrar el despacho")
        } finally {
            setSubmitting(false)
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

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={`Despachar Orden NV-${order?.number}`}
            description={`Cliente: ${order?.customer_name}`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
                            <SubmitButton
                                onClick={handleDispatch}
                                loading={submitting}
                                disabled={
                                    !selectedWarehouse ||
                                    order?.lines.some((line: any) => {
                                        const qty = deliveryQuantities[line.id] || 0
                                        if (qty <= 0) return false
                                        const status = getStockStatus(line)
                                        return status?.type === 'error'
                                    })
                                }
                            >
                                Confirmar Despacho
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="space-y-4">
                <FormSection title="Configuración de Entrega" icon={Package} />
                <div className="grid grid-cols-2 gap-4">
                    <LabeledSelect
                        label="Bodega de Despacho"
                        value={selectedWarehouse?.toString() || ''}
                        onChange={(val) => setSelectedWarehouse(Number(val))}
                        placeholder="Seleccione bodega"
                        options={warehouses.map((warehouse: any) => ({
                            value: warehouse.id.toString(),
                            label: `${warehouse.name} (${warehouse.code})`,
                        }))}
                    />

                    <PeriodValidationDateInput
                        label="Fecha de Despacho"
                        date={deliveryDate ? new Date(deliveryDate + 'T12:00:00') : undefined}
                        onDateChange={(d) => {
                            if (!d) {
                                setDeliveryDate("")
                                return
                            }
                            setDeliveryDate(d.toISOString().split('T')[0])
                        }}
                        validationType="accounting"
                        required
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Estado de Despacho:</span>
                    <StatusBadge
                        status={
                            order?.delivery_status === 'DELIVERED' ? 'delivered' :
                                order?.delivery_status === 'PARTIAL' ? 'partial' :
                                    'pending'
                        }
                    />
                </div>

                <FormSection title="Detalle de Productos" icon={Package} />
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Unidad</TableHead>
                                <TableHead className="text-center">Pendiente</TableHead>
                                <TableHead className="text-center">Stock</TableHead>
                                <TableHead className="text-center">A Despachar</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order?.lines.map((line: any) => {
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
                                                            <span className="text-[8px] font-bold uppercase text-primary/70 bg-primary/5 px-1 py-0.5 rounded border border-primary/20 leading-none">
                                                                {line.requires_advanced_manufacturing ? 'Fabricación Avanzada' : 'Fabricable'}
                                                            </span>
                                                        )}

                                                        {line.work_order_summary ? (
                                                            <div className="flex flex-col items-center mt-1">
                                                                <StatusBadge
                                                                    status={line.work_order_summary.status.toLowerCase()}
                                                                    size="sm"
                                                                    className="text-[8px]"
                                                                />
                                                                <span className="text-[8px] text-muted-foreground mt-0.5">{line.work_order_summary.number}</span>
                                                            </div>
                                                        ) : !line.requires_advanced_manufacturing && !line.track_inventory ? (
                                                            <span className={cn(
                                                                "text-[10px] font-black",
                                                                (line.manufacturable_quantity ?? 0) >= line.quantity_pending ? "text-success" : "text-destructive"
                                                            )}>
                                                                {line.manufacturable_quantity ?? 0}
                                                            </span>
                                                        ) : line.requires_advanced_manufacturing ? (
                                                            <span className="text-[8px] text-destructive">Sin OT registrada</span>
                                                        ) : null}
                                                    </>
                                                )}

                                                {!line.track_inventory && line.product_type !== 'MANUFACTURABLE' && (
                                                    <span className="text-[8px] font-bold uppercase text-success/80 bg-success/5 px-1.5 py-0.5 rounded border border-success/20 leading-none">Disponible</span>
                                                )}
                                            </div>
                                        </TableCell>
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
        </BaseModal>
    )
}

export default DeliveryModal
