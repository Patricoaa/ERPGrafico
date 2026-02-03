"use client"

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
import { FORM_STYLES } from "@/lib/styles"

interface PurchaseOrderLine {
    id: number
    product: number
    product_name: string
    product_type: string
    quantity: number
    quantity_received: number
    quantity_pending: number
    unit_cost: number
    uom_name: string
}

interface PurchaseOrder {
    id: number
    number: string
    supplier_name: string
    lines: PurchaseOrderLine[]
    receiving_status: string
    warehouse: number
}

interface Warehouse {
    id: number
    name: string
    code: string
}

interface ReceiptModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    onSuccess?: () => void
    isRefund?: boolean
    filterType?: 'PRODUCT' | 'SERVICE' | 'ALL'
}

export function ReceiptModal({
    open,
    onOpenChange,
    orderId,
    onSuccess,
    isRefund = false,
    filterType = 'ALL'
}: ReceiptModalProps) {
    const [order, setOrder] = useState<PurchaseOrder | null>(null)
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [receiptQuantities, setReceiptQuantities] = useState<{ [lineId: number]: number }>({})
    const [receiptCosts, setReceiptCosts] = useState<{ [lineId: number]: number }>({})
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
    const [deliveryReference, setDeliveryReference] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [isPartialReceipt, setIsPartialReceipt] = useState(false)

    useEffect(() => {
        if (open && orderId) {
            fetchData()
        }
    }, [open, orderId])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch order details
            const orderResponse = await api.get(`/purchasing/orders/${orderId}/`)
            setOrder(orderResponse.data)

            // Initialize quantities and costs
            const initialQuantities: { [lineId: number]: number } = {}
            const initialCosts: { [lineId: number]: number } = {}

            orderResponse.data.lines.forEach((line: PurchaseOrderLine) => {
                initialQuantities[line.id] = Math.ceil(line.quantity_pending)
                initialCosts[line.id] = Math.ceil(line.unit_cost)
            })
            setReceiptQuantities(initialQuantities)
            setReceiptCosts(initialCosts)

            // Fetch warehouses
            const warehousesResponse = await api.get('/inventory/warehouses/')
            const warehousesList = warehousesResponse.data.results || warehousesResponse.data
            setWarehouses(warehousesList)

            // Default to order warehouse
            if (orderResponse.data.warehouse) {
                setSelectedWarehouse(orderResponse.data.warehouse)
            } else if (warehousesList.length > 0) {
                setSelectedWarehouse(warehousesList[0].id)
            }
        } catch (error) {
            console.error("Error fetching data:", error)
            toast.error(isRefund ? "Error al cargar los datos de devolución" : "Error al cargar los datos de recepción")
        } finally {
            setLoading(false)
        }
    }

    const handleQuantityChange = (lineId: number, value: string) => {
        const numValue = Math.ceil(parseFloat(value) || 0)
        setReceiptQuantities(prev => ({
            ...prev,
            [lineId]: numValue
        }))

        // Check if it's a partial receipt
        const line = order?.lines.find(l => l.id === lineId)
        if (line && numValue < line.quantity_pending) {
            setIsPartialReceipt(true)
        }
    }

    const handleCostChange = (lineId: number, value: string) => {
        const numValue = Math.ceil(parseFloat(value) || 0)
        setReceiptCosts(prev => ({
            ...prev,
            [lineId]: numValue
        }))
    }

    const handleReceive = async () => {
        if (!selectedWarehouse) {
            toast.error("Seleccione una bodega de recepción")
            return
        }

        setSubmitting(true)
        try {
            // Prepare line data
            const lineData = order?.lines.map(line => {
                const qty = receiptQuantities[line.id] || 0
                const cost = receiptCosts[line.id] || line.unit_cost

                if (qty > 0) {
                    return {
                        line_id: line.id,
                        quantity: qty,
                        unit_cost: cost
                    }
                }
                return null
            }).filter(item => item !== null) || []

            if (lineData.length === 0) {
                toast.error(isRefund ? "Ingrese al menos una cantidad a devolver" : "Ingrese al menos una cantidad a recibir")
                setSubmitting(false)
                return
            }

            // Always use partial_receive/return as it's more flexible
            const endpoint = isRefund ? `/purchasing/orders/${orderId}/partial_return/` : `/purchasing/orders/${orderId}/partial_receive/`
            await api.post(endpoint, {
                warehouse_id: selectedWarehouse,
                receipt_date: receiptDate,
                delivery_reference: deliveryReference,
                notes: notes,
                line_data: lineData
            })

            toast.success(isRefund ? "Devolución registrada correctamente" : "Recepción registrada correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            console.error("Error receiving order:", error)
            toast.error(error.response?.data?.error || (isRefund ? "Error al registrar la devolución" : "Error al registrar la recepción"))
        } finally {
            setSubmitting(false)
        }
    }

    const getStatus = (line: PurchaseOrderLine) => {
        const requestedQty = receiptQuantities[line.id] || 0

        if (requestedQty === 0) return null
        if (requestedQty === line.quantity_pending) {
            return { type: 'success', message: 'Completo' }
        }
        if (requestedQty > line.quantity_pending) {
            return { type: 'error', message: 'Excede pendiente' }
        }
        return { type: 'warning', message: 'Parcial' }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={`${isRefund ? "Devolver Productos" : (filterType === 'SERVICE' ? "Confirmar Entrega de Servicios" : "Recibir Orden")} OCS-${order?.number}`}
            description={`Proveedor: ${order?.supplier_name}`}
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleReceive} disabled={loading || submitting || !selectedWarehouse}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRefund ? 'Confirmar Devolución' : (filterType === 'SERVICE' ? 'Confirmar Entrega' : 'Confirmar Recepción')}
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
                            <Label htmlFor="warehouse" className={FORM_STYLES.label}>Bodega de {isRefund ? 'Salida' : 'Recepción'}</Label>
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
                            <Label htmlFor="receipt-date" className={FORM_STYLES.label}>Fecha de {isRefund ? 'Devolución' : 'Recepción'}</Label>
                            <Input
                                id="receipt-date"
                                type="date"
                                className={FORM_STYLES.input}
                                value={receiptDate}
                                onChange={(e) => setReceiptDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="delivery-reference" className={FORM_STYLES.label}>Referencia (Guía/Comprobante)</Label>
                            <Input
                                id="delivery-reference"
                                placeholder="Ej: GD-12345"
                                className={FORM_STYLES.input}
                                value={deliveryReference}
                                onChange={(e) => setDeliveryReference(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes" className={FORM_STYLES.label}>Notas / Observaciones</Label>
                            <Input
                                id="notes"
                                placeholder="Mercadería recibida en buen estado..."
                                className={FORM_STYLES.input}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Receiving Status */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Estado de {isRefund ? 'Devolución' : 'Recepción'}:</span>
                        <Badge variant={
                            order?.receiving_status === 'RECEIVED' ? 'success' :
                                order?.receiving_status === 'PARTIAL' ? 'secondary' :
                                    'outline'
                        }>
                            {order?.receiving_status === 'RECEIVED' ? (isRefund ? 'Devuelto' : 'Recibido') :
                                order?.receiving_status === 'PARTIAL' ? 'Parcial' :
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
                                    <TableHead className="text-center w-24">A {isRefund ? 'Devolver' : 'Recibir'}</TableHead>
                                    <TableHead className="text-center w-32">Costo (Unit)</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order?.lines
                                    .filter(line => {
                                        if (filterType === 'PRODUCT') return line.product_type !== 'SERVICE';
                                        if (filterType === 'SERVICE') return line.product_type === 'SERVICE';
                                        return true;
                                    })
                                    .map(line => {
                                        const status = getStatus(line)

                                        return (
                                            <TableRow key={line.id}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{line.product_name}</div>
                                                        <div className="text-xs text-muted-foreground">Original: ${line.unit_cost}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="font-normal border-none bg-muted/50">{line.uom_name}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline">{line.quantity_pending}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max={line.quantity_pending}
                                                        step="1"
                                                        value={receiptQuantities[line.id] || 0}
                                                        onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                                                        className="w-24 text-center mx-auto h-8 rounded-lg border-dashed bg-background focus-visible:ring-primary font-bold"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={receiptCosts[line.id] || 0}
                                                        onChange={(e) => handleCostChange(line.id, e.target.value)}
                                                        className="w-32 text-center mx-auto h-8 rounded-lg border-dashed bg-background focus-visible:ring-primary font-bold"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {status && (
                                                        <div className="flex items-center gap-1 text-xs">
                                                            {status.type === 'error' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                                            {status.type === 'success' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                                                            {status.type === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-600" />}
                                                            <span className={
                                                                status.type === 'error' ? 'text-destructive' :
                                                                    status.type === 'success' ? 'text-green-600' :
                                                                        'text-yellow-600'
                                                            }>
                                                                {status.message}
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

                    {/* Warning if partial receipt */}
                    {isPartialReceipt && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Recepción parcial: La orden permanecerá abierta hasta completar las cantidades.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
        </BaseModal>
    )
}
