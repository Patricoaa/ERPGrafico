"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
    const [order, setOrder] = useState<SaleOrder | null>(null)
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [stockLevels, setStockLevels] = useState<StockLevel>({})
    const [deliveryQuantities, setDeliveryQuantities] = useState<{ [lineId: number]: number }>({})
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [isPartialDispatch, setIsPartialDispatch] = useState(false)

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

            let availableStock = stockLevels[line.product] || 0
            if (!line.track_inventory) {
                if (line.product_type === 'MANUFACTURABLE') {
                    availableStock = line.manufacturable_quantity ?? 0
                } else {
                    return false // Services/Others skip check
                }
            }

            return requestedQty > 0 && requestedQty > availableStock
        })

        if (insufficientStock) {
            toast.error("Stock insuficiente para algunos productos")
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
        } catch (error: any) {
            console.error("Error dispatching order:", error)
            toast.error(error.response?.data?.error || "Error al registrar el despacho")
        } finally {
            setSubmitting(false)
        }
    }

    const getStockStatus = (line: SaleOrderLine) => {
        const requestedQty = deliveryQuantities[line.id] || 0

        let availableStock = stockLevels[line.product] || 0
        if (!line.track_inventory && line.product_type === 'MANUFACTURABLE') {
            availableStock = line.manufacturable_quantity ?? 0
        }

        if (requestedQty === 0) return null

        // Skip stock check for non-tracked services or products without BOM
        if (!line.track_inventory && line.product_type !== 'MANUFACTURABLE') {
            return { type: 'success', message: 'Servicio/Sin stock' }
        }

        if (requestedQty > availableStock) {
            return { type: 'error', message: `Stock insuficiente (${availableStock} disponibles)` }
        }
        if (requestedQty === line.quantity_pending) {
            return { type: 'success', message: 'Despacho completo' }
        }
        return { type: 'warning', message: 'Despacho parcial' }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1200px] w-[90vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Despachar Orden NV-{order?.number}
                    </DialogTitle>
                    <DialogDescription>
                        Cliente: {order?.customer_name}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Warehouse and Date Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="warehouse">Bodega de Despacho</Label>
                                <select
                                    id="warehouse"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={selectedWarehouse || ''}
                                    onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
                                >
                                    {warehouses.map(warehouse => (
                                        <option key={warehouse.id} value={warehouse.id}>
                                            {warehouse.name} ({warehouse.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery-date">Fecha de Despacho</Label>
                                <Input
                                    id="delivery-date"
                                    type="date"
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
                        <div className="rounded-md border">
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
                                                        <div className="text-xs text-muted-foreground">{line.description}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="font-normal border-none bg-muted/50">{line.uom_name}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline">{line.quantity_pending}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {line.track_inventory ? (
                                                        <Badge variant={availableStock >= line.quantity_pending ? "success" : "destructive"}>
                                                            {availableStock}
                                                        </Badge>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            {line.product_type === 'MANUFACTURABLE' ? (
                                                                <>
                                                                    <Badge variant="outline" className="text-[9px] border-blue-200 bg-blue-50 text-blue-700">Fabricable</Badge>
                                                                    <Badge variant={(line.manufacturable_quantity ?? 0) >= line.quantity_pending ? "success" : "destructive"} className="text-[10px]">
                                                                        {line.manufacturable_quantity ?? 0}
                                                                    </Badge>
                                                                </>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[9px] border-emerald-200 bg-emerald-50 text-emerald-700">Disponible</Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max={line.quantity_pending}
                                                        step="0.01"
                                                        value={deliveryQuantities[line.id] || 0}
                                                        onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                                                        className="w-24 text-center"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {stockStatus && (
                                                        <div className="flex items-center gap-1 text-xs">
                                                            {stockStatus.type === 'error' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                                            {stockStatus.type === 'success' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                                                            {stockStatus.type === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-600" />}
                                                            <span className={
                                                                stockStatus.type === 'error' ? 'text-destructive' :
                                                                    stockStatus.type === 'success' ? 'text-green-600' :
                                                                        'text-yellow-600'
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

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleDispatch} disabled={loading || submitting || !selectedWarehouse}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Despacho
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
