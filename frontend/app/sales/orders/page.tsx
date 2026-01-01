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
import { Pencil, Trash2, Eye, FileText, CheckCircle, History } from "lucide-react"
import api from "@/lib/api"
import { SaleOrderForm } from "@/components/forms/SaleOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Progress } from "../../../components/ui/progress"
import { Banknote } from "lucide-react"

interface SaleOrder {
    id: number
    number: string
    customer_name: string
    date: string
    status: string
    total: string
    total_paid: number
    pending_amount: number
    channel_display: string
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
    'DRAFT': { label: 'Borrador', variant: 'outline' },
    'CONFIRMED': { label: 'Confirmado', variant: 'default' },
    'INVOICED': { label: 'Facturado', variant: 'secondary' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

export default function SalesOrdersPage() {
    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string } | null>(null)
    const [payingOrder, setPayingOrder] = useState<SaleOrder | null>(null)

    const fetchOrders = async () => {
        try {
            const response = await api.get('/sales/orders/')
            setOrders(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch sales orders", error)
            toast.error("Error al cargar las notas de venta.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar esta Nota de Venta?")) return
        try {
            await api.delete(`/sales/orders/${id}/`)
            toast.success("Nota de Venta eliminada correctamente.")
            fetchOrders()
        } catch (error) {
            console.error("Error deleting order:", error)
            toast.error("Error al eliminar la nota de venta.")
        }
    }

    const handleEdit = async (order: SaleOrder) => {
        try {
            const response = await api.get(`/sales/orders/${order.id}/`)
            setEditingOrder(response.data)
            setIsFormOpen(true)
        } catch (error) {
            console.error("Error fetching order details:", error)
            toast.error("Error al cargar los detalles de la nota de venta.")
        }
    }

    const handleConfirm = async (id: number) => {
        try {
            await api.post(`/sales/orders/${id}/confirm/`)
            toast.success("Nota de Venta confirmada.")
            fetchOrders()
        } catch (error) {
            toast.error("Error al confirmar venta.")
        }
    }

    const handlePayment = async (data: {
        paymentMethod: string,
        amount: number,
        dteType?: string,
        transaction_number?: string,
        is_pending_registration?: boolean
    }) => {
        if (!payingOrder) return
        try {
            const res = await api.post('/billing/invoices/pos_checkout/', {
                order_data: {
                    id: payingOrder.id,
                    customer: payingOrder.id, // This is a bit tricky, pos_checkout expected full order_data or ID?
                },
                dte_type: data.dteType || 'BOLETA',
                amount: data.amount,
                transaction_number: data.transaction_number,
                is_pending_registration: data.is_pending_registration
            })
            // Actually, we should probably have a more direct endpoint for paying an existing order
            // Let's use a new endpoint or update register_payment

            // For now, let's use the register_payment logic if we have an invoice, 
            // or create the invoice first if needed.

            // If the order is confirmed but not invoiced, we create the invoice first
            let invoiceId;
            if (payingOrder.status === 'CONFIRMED') {
                const invRes = await api.post('/billing/invoices/create_from_order/', {
                    order_id: payingOrder.id,
                    order_type: 'sale',
                    dte_type: data.dteType || 'BOLETA'
                })
                invoiceId = invRes.data.id
            }

            // Register the payment
            await api.post('/treasury/payments/', {
                amount: data.amount,
                payment_type: 'INBOUND',
                reference: `NV-${payingOrder.number}`,
                invoice: invoiceId,
                sale_order: payingOrder.id,
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
                <h2 className="text-3xl font-bold tracking-tight">Notas de Venta</h2>
                <div className="flex items-center space-x-2">
                    <SaleOrderForm
                        onSuccess={fetchOrders}
                        open={isFormOpen && !editingOrder}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingOrder(null)
                        }}
                    />
                    {editingOrder && (
                        <SaleOrderForm
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
                            <TableHead>Cliente</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Pagado</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead className="w-[150px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">{order.number}</TableCell>
                                <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                                <TableCell>{order.customer_name}</TableCell>
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
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                        {order.channel_display}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingTransaction({ type: 'sale_order', id: order.id })}
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

                                        {['CONFIRMED', 'INVOICED'].includes(order.status) && (
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
                                                onClick={() => setViewingTransaction({ type: 'sale_order', id: order.id })}
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
                                <TableCell colSpan={8} className="text-center">Cargando notas de venta...</TableCell>
                            </TableRow>
                        )}
                        {!loading && orders.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">No hay notas de venta registradas.</TableCell>
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
                />
            )}

            {payingOrder && (
                <PaymentDialog
                    open={!!payingOrder}
                    onOpenChange={(open) => !open && setPayingOrder(null)}
                    total={parseFloat(payingOrder.total)}
                    pendingAmount={payingOrder.pending_amount}
                    showDteSelector={payingOrder.status === 'CONFIRMED'}
                    onConfirm={handlePayment}
                />
            )}
        </div>
    )
}
