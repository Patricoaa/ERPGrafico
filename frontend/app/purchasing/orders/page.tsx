"use client"

import { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, CheckCircle, Package, FileText, History } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Progress } from "@/components/ui/progress"
import { Banknote, Eye, TrendingDown } from "lucide-react"
import { ReceiptModal } from "@/components/purchasing/ReceiptModal"

interface PurchaseOrder {
    id: number
    number: string
    supplier_name: string
    date: string
    status: string
    total: string
    warehouse_name: string
    total_paid: number
    pending_amount: number
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" }> = {
    'DRAFT': { label: 'Borrador', variant: 'outline' },
    'CONFIRMED': { label: 'Confirmado', variant: 'default' },
    'RECEIVED': { label: 'Recibido', variant: 'secondary' },
    'INVOICED': { label: 'Facturado', variant: 'info' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [payingOrder, setPayingOrder] = useState<PurchaseOrder | null>(null)
    const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null)

    const fetchOrders = async () => {
        try {
            const response = await api.get('/purchasing/orders/')
            setOrders(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch purchase orders", error)
            toast.error("Error al cargar las órdenes de compra.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar esta Orden de Compra?")) return
        try {
            await api.delete(`/purchasing/orders/${id}/`)
            toast.success("Orden de Compra eliminada correctamente.")
            fetchOrders()
        } catch (error) {
            console.error("Error deleting order:", error)
            toast.error("Error al eliminar la orden de compra.")
        }
    }

    const handleEdit = async (order: PurchaseOrder) => {
        try {
            const response = await api.get(`/purchasing/orders/${order.id}/`)
            setEditingOrder(response.data)
            setIsFormOpen(true)
        } catch (error) {
            console.error("Error fetching order details:", error)
            toast.error("Error al cargar los detalles de la orden de compra.")
        }
    }

    const handleConfirm = async (id: number) => {
        try {
            await api.post(`/purchasing/orders/${id}/confirm/`)
            toast.success("Orden de Compra confirmada.")
            fetchOrders()
        } catch (error) {
            toast.error("Error al confirmar.")
        }
    }

    const handleReceive = (order: PurchaseOrder) => {
        setReceivingOrder(order)
    }

    const handleInvoice = async (order: PurchaseOrder) => {
        const invNum = prompt("Ingrese el número de factura del proveedor:")
        if (!invNum) return

        try {
            await api.post('/billing/invoices/create_from_order/', {
                order_id: order.id,
                order_type: 'purchase',
                dte_type: 'PURCHASE_INV',
                supplier_invoice_number: invNum
            })
            toast.success("Factura de proveedor registrada.")
            fetchOrders()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar factura.")
        }
    }

    const handlePayment = async (data: {
        paymentMethod: string,
        amount: number,
        transaction_number?: string,
        is_pending_registration?: boolean
    }) => {
        if (!payingOrder) return
        try {
            // Register the payment
            await api.post('/treasury/payments/', {
                amount: data.amount,
                payment_type: 'OUTBOUND',
                reference: `OC-${payingOrder.number}`,
                purchase_order: payingOrder.id,
                payment_method: data.paymentMethod,
                transaction_number: data.transaction_number,
                is_pending_registration: data.is_pending_registration
            })

            toast.success("Pago registrado correctamente")
            setPayingOrder(null)
            fetchOrders()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al procesar el pago")
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Ordenes de Compra</h2>
                <div className="flex items-center space-x-2">
                    <PurchaseOrderForm
                        onSuccess={fetchOrders}
                        open={isFormOpen && !editingOrder}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingOrder(null)
                        }}
                    />
                    {editingOrder && (
                        <PurchaseOrderForm
                            initialData={editingOrder}
                            open={isFormOpen && !!editingOrder}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingOrder(null)
                            }}
                            onSuccess={fetchOrders}
                        />
                    )}
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Almacén</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Pagado</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[150px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">{order.number}</TableCell>
                                <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                                <TableCell>{order.supplier_name}</TableCell>
                                <TableCell>{order.warehouse_name}</TableCell>
                                <TableCell>{parseFloat(order.total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</TableCell>
                                <TableCell>
                                    <div className="space-y-1 w-32">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span>{Math.round((order.total_paid / parseFloat(order.total)) * 100)}%</span>
                                            <span>${order.total_paid.toLocaleString()}</span>
                                        </div>
                                        <Progress value={(order.total_paid / parseFloat(order.total)) * 100} className="h-1" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={statusMap[order.status]?.variant || "default"}>
                                        {statusMap[order.status]?.label || order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingTransaction({ type: 'purchase_order', id: order.id, view: 'details' })}
                                            title="Ver Detalles"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(order)}
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4 text-orange-500" />
                                        </Button>

                                        {order.status === 'DRAFT' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-blue-600"
                                                onClick={() => handleConfirm(order.id)}
                                                title="Confirmar"
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {order.status === 'CONFIRMED' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-orange-600"
                                                onClick={() => handleReceive(order)}
                                                title="Recibir Mercadería"
                                            >
                                                <Package className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {['RECEIVED', 'INVOICED', 'CONFIRMED'].includes(order.status) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-emerald-600"
                                                onClick={() => setPayingOrder(order)}
                                                title="Registrar Pago"
                                            >
                                                <Banknote className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {order.total_paid > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-blue-500"
                                                onClick={() => setViewingTransaction({ type: 'purchase_order', id: order.id, view: 'history' })}
                                                title="Historial de Pagos"
                                            >
                                                <History className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(order.id)}
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">Cargando órdenes de compra...</TableCell>
                            </TableRow>
                        )}
                        {!loading && orders.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">No hay órdenes de compra registradas.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}

            {payingOrder && (
                <PaymentDialog
                    open={!!payingOrder}
                    onOpenChange={(open) => !open && setPayingOrder(null)}
                    total={parseFloat(payingOrder.total)}
                    pendingAmount={payingOrder.pending_amount}
                    onConfirm={handlePayment}
                />
            )}

            {receivingOrder && (
                <ReceiptModal
                    open={!!receivingOrder}
                    onOpenChange={(open) => !open && setReceivingOrder(null)}
                    orderId={receivingOrder.id}
                    onSuccess={fetchOrders}
                />
            )}
        </div>
    )
}
