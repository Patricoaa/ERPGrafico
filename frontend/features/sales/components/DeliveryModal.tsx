"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn, formatPlainDate } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
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

export function DeliveryModal({ open, onOpenChange, orderId, onSuccess }: DeliveryModalProps) {
    const { dateString } = useServerDate()
    const [order, setOrder] = useState<SaleOrder | null>(null)
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [stockLevels, setStockLevels] = useState<StockLevel>({})
    const [deliveryQuantities, setDeliveryQuantities] = useState<{ [lineId: number]: number }>({})
    const [deliveryDate, setDeliveryDate] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [isPartialDispatch, setIsPartialDispatch] = useState(false)

    // Sync delivery date with server date
    useEffect(() => {
        if (dateString && !deliveryDate) {
            setDeliveryDate(dateString)
        }
    }, [dateString])

    useEffect(() => {
        if (open && orderId) {
            fetchData()
        }
    }, [open, orderId])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch order details
            const orderResponse = await api.get(`/sales/orders/${orderId}/`)
            setOrder(orderResponse.data)

            // Initialize delivery quantities with pending quantities
            const initialQuantities: { [lineId: number]: number } = {}
            orderResponse.data.lines.forEach((line: SaleOrderLine) => {
                initialQuantities[line.id] = line.quantity_pending
            })
            setDeliveryQuantities(initialQuantities)

            // Fetch warehouses
            const warehousesResponse = await api.get('/inventory/warehouses/')
            const warehousesList = warehousesResponse.data.results || warehousesResponse.data
            setWarehouses(warehousesList)

            if (warehousesList.length > 0) {
                setSelectedWarehouse(warehousesList[0].id)
            }
        } catch (error) {
            console.error("Error fetching data:", error)
            toast.error("Error al cargar los datos del despacho")
        } finally {
            setLoading(false)
        }
    }

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
                    // Correct endpoint and use filter
                    const response = await api.get(`/inventory/moves/?product_id=${productId}&warehouse_id=${selectedWarehouse}`)
                    // Handle paginated or non-paginated response
                    const moves = response.data.results || response.data
                    // The results might be a list of moves, we need to sum their quantities
                    const totalStock = moves.reduce((sum: number, move: any) => sum + parseFloat(move.quantity || 0), 0)
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

        // Check if it's a partial dispatch
        const line = order?.lines.find(l => l.id === lineId)
        if (line && numValue < line.quantity_pending) {
            setIsPartialDispatch(true)
        }
    }

    const handleDispatch = async () => {
        if (!selectedWarehouse) {
            toast.error("Seleccione una bodega")
            return
        }

        // Validate stock
        const insufficientStock = order?.lines.some(line => {
            const requestedQty = deliveryQuantities[line.id] || 0
            if (requestedQty <= 0) return false

            // Skip stock validation for advanced manufacturing if production is finished
            // The stock was already created when the OT was finalized
            if (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) {
                const isFinished = (line as any).is_production_finished
                if (isFinished) {
                    return false // Skip stock check, production is complete
                }
                // If not finished, will be caught by the production validation below
                return false
            }

            let availableStock = stockLevels[line.product] || 0
            if (!line.track_inventory) {
                if (line.product_type === 'MANUFACTURABLE') {
                    availableStock = line.manufacturable_quantity ?? 0
                } else {
                    return false // Services/Others skip check
                }
            }

            return requestedQty > availableStock
        })

        if (insufficientStock) {
            toast.error("Stock insuficiente para algunos productos")
            return
        }

        // Validate production status
        const pendingProduction = order?.lines.some(line => {
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
            // Determine if it's partial or full dispatch
            const hasPartialQuantities = order?.lines.some(line => {
                const requestedQty = deliveryQuantities[line.id] || 0
                return requestedQty > 0 && requestedQty < line.quantity_pending
            })

            if (hasPartialQuantities || isPartialDispatch) {
                // Partial dispatch
                const lineQuantities: { [key: string]: number } = {}
                order?.lines.forEach(line => {
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
                // Full dispatch
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

        // 1. Advanced Manufacturing Check
        if (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) {
            const isFinished = (line as any).is_production_finished
            if (!isFinished) {
                return {
                    type: 'error',
                    message: 'Producción Pendiente (OT debe estar terminada)',
                    icon: AlertTriangle
                }
            }
        }

        // 2. Express Manufacturing Check (BOM Components)
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

        // 3. Storable Product Check
        if (line.product_type === 'STORABLE' && line.track_inventory) {
            if (requestedQty > availableStock) {
                return {
                    type: 'error',
                    message: `Stock insuficiente (${availableStock} disponibles)`,
                    icon: AlertTriangle
                }
            }
        }

        // If we reach here, validation passed
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
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleDispatch}
                        disabled={
                            loading ||
                            submitting ||
                            !selectedWarehouse ||
                            order?.lines.some(line => {
                                const qty = deliveryQuantities[line.id] || 0
                                if (qty <= 0) return false
                                const status = getStockStatus(line)
                                return status?.type === 'error'
                            })
                        }
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Despacho
                    </Button>
                </>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Warehouse and Date Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="warehouse" className={FORM_STYLES.label}>Bodega de Despacho</Label>
                            <Select
                                value={selectedWarehouse?.toString() || ''}
                                onValueChange={(val) => setSelectedWarehouse(Number(val))}
                            >
                                <SelectTrigger className={FORM_STYLES.input}>
                                    <SelectValue placeholder="Seleccione bodega" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(warehouse => (
                                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                            {warehouse.name} ({warehouse.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delivery-date" className={FORM_STYLES.label}>Fecha de Despacho</Label>
                            <Input
                                id="delivery-date"
                                type="date"
                                className={FORM_STYLES.input}
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Delivery Status */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Estado de Despacho:</span>
                        <Badge variant={
                            order?.delivery_status === 'DELIVERED' ? 'success' :
                                order?.delivery_status === 'PARTIAL' ? 'secondary' :
                                    'outline'
                        }>
                            {order?.delivery_status === 'DELIVERED' ? 'Entregado' :
                                order?.delivery_status === 'PARTIAL' ? 'Parcial' :
                                    'Pendiente'}
                        </Badge>
                    </div>

                    {/* Products Table */}
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
                                {order?.lines.map(line => {
                                    const stockStatus = getStockStatus(line)
                                    const availableStock = stockLevels[line.product] || 0

                                    return (
                                        <TableRow key={line.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">{line.product_name}</div>
                                                    <div className={cn(FORM_STYLES.input, "cursor-pointer h-10")}>{line.description}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="font-normal border-none bg-muted/50">{line.uom_name}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">{line.quantity_pending}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    {line.track_inventory && (
                                                        <Badge variant={availableStock >= line.quantity_pending ? "success" : "destructive"}>
                                                            {availableStock}
                                                        </Badge>
                                                    )}

                                                    {line.product_type === 'MANUFACTURABLE' && (
                                                        <>
                                                            {!line.track_inventory && (
                                                                <Badge variant="outline" className="text-[9px] border-primary/20 bg-primary/10 text-primary">
                                                                    {line.requires_advanced_manufacturing ? 'Fabricación Avanzada' : 'Fabricable'}
                                                                </Badge>
                                                            )}

                                                            {(line as any).work_order_summary ? (
                                                                <div className="flex flex-col items-center mt-1">
                                                                    <Badge
                                                                        variant={(line as any).work_order_summary.status === 'FINISHED' ? "success" : "outline"}
                                                                        className={cn("text-[9px] px-1.5 py-0", (line as any).work_order_summary.status === 'FINISHED' ? "" : "bg-warning/10 text-warning border-warning/20")}
                                                                    >
                                                                        OT: {(line as any).work_order_summary.status_display}
                                                                    </Badge>
                                                                    <span className="text-[8px] text-muted-foreground mt-0.5">{(line as any).work_order_summary.number}</span>
                                                                </div>
                                                            ) : !line.requires_advanced_manufacturing && !line.track_inventory ? (
                                                                <Badge variant={(line.manufacturable_quantity ?? 0) >= line.quantity_pending ? "success" : "destructive"} className="text-[10px]">
                                                                    {line.manufacturable_quantity ?? 0}
                                                                </Badge>
                                                            ) : line.requires_advanced_manufacturing ? (
                                                                <span className="text-[8px] text-destructive">Sin OT registrada</span>
                                                            ) : null}
                                                        </>
                                                    )}

                                                    {!line.track_inventory && line.product_type !== 'MANUFACTURABLE' && (
                                                        <Badge variant="outline" className="text-[9px] border-success/20 bg-success/10 text-success">Disponible</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={line.quantity_pending}
                                                    step="0.01"
                                                    value={deliveryQuantities[line.id] || 0}
                                                    onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                                                    className={cn(FORM_STYLES.input, "w-24 text-center mx-auto h-8 font-bold")}
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

                    {/* Warning if partial dispatch */}
                    {isPartialDispatch && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Se realizará un despacho parcial. Podrás crear despachos adicionales para las cantidades restantes.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
        </BaseModal>
    )
}

export default DeliveryModal
