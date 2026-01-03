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
import { Progress } from "@/components/ui/progress"
import { Banknote, Eye, TrendingDown, FileBadge } from "lucide-react"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { ReceiptModal } from "@/components/purchasing/ReceiptModal"
import { DocumentRegistrationModal } from "@/components/purchasing/DocumentRegistrationModal"
import { PurchaseNoteModal } from "@/components/purchasing/PurchaseNoteModal"

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
    is_invoiced: boolean
    receiving_status: string
    invoice_details?: {
        dte_type: string
        number: string
        document_attachment: string | null
    } | null
    related_documents?: {
        invoices: any[]
        notes: any[]
        receipts: any[]
        payments: any[]
    }
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
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [notingOrder, setNotingOrder] = useState<PurchaseOrder | null>(null)


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
        setInvoicingOrder(order)
    }

    const handlePayment = async (data: any) => {
        if (!payingOrder) return
        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())
            formData.append('payment_type', 'OUTBOUND')
            formData.append('reference', `OC-${payingOrder.number}`)
            formData.append('purchase_order', payingOrder.id.toString())
            formData.append('payment_method', data.paymentMethod)
            if (data.transaction_number) formData.append('transaction_number', data.transaction_number)
            if (data.is_pending_registration !== undefined) formData.append('is_pending_registration', data.is_pending_registration.toString())
            if (data.treasury_account_id) formData.append('treasury_account_id', data.treasury_account_id)
            if (data.dteType) formData.append('dte_type', data.dteType)
            if (data.documentReference) formData.append('document_reference', data.documentReference)
            if (data.documentAttachment) formData.append('document_attachment', data.documentAttachment)

            await api.post('/treasury/payments/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
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
                            <TableHead>Documentos</TableHead>
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
                                    <div className="flex flex-col gap-1">
                                        {order.related_documents?.invoices.map((inv: any) => (
                                            <button
                                                key={inv.id}
                                                onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">Factura</span>
                                                #{inv.number}
                                            </button>
                                        ))}
                                        {order.related_documents?.notes.map((note: any) => (
                                            <button
                                                key={note.id}
                                                onClick={() => setViewingTransaction({ type: 'invoice', id: note.id, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">Nota {note.type === 'NOTA_CREDITO' ? 'Crédito' : 'Débito'}</span>
                                                #{note.number}
                                            </button>
                                        ))}
                                        {(order.related_documents?.receipts?.length ?? 0) > 0 && (
                                            <button
                                                onClick={() => setViewingTransaction({ type: 'purchase_order', id: order.id, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">Recepciones</span>
                                                <span className="text-[10px]">{order.related_documents?.receipts?.length} recep.</span>
                                            </button>
                                        )}
                                        {(order.related_documents?.payments?.length ?? 0) > 0 && (
                                            <button
                                                onClick={() => setViewingTransaction({ type: 'purchase_order', id: order.id, view: 'history' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">Pagos</span>
                                                <span className="text-[10px]">{order.related_documents?.payments?.length} reg.</span>
                                            </button>
                                        )}
                                        {!order.related_documents?.invoices.length && !order.related_documents?.notes.length && !order.related_documents?.receipts.length && !order.related_documents?.payments.length && (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </div>
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
                                            title={order.status === 'DRAFT' ? "Editar" : "Solo se puede editar en Borrador"}
                                            disabled={order.status !== 'DRAFT'}
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

                                        {['CONFIRMED', 'INVOICED', 'RECEIVED', 'PAID'].includes(order.status) && order.receiving_status !== 'RECEIVED' && (
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

                                        {['RECEIVED', 'CONFIRMED', 'PAID'].includes(order.status) && !order.is_invoiced && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-emerald-500"
                                                onClick={() => handleInvoice(order)}
                                                title="Registrar Factura/Boleta"
                                            >
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {['RECEIVED', 'INVOICED', 'CONFIRMED', 'PAID'].includes(order.status) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-amber-600"
                                                onClick={() => setNotingOrder(order)}
                                                title="Registrar Nota Crédito/Débito"
                                            >
                                                <FileBadge className="h-4 w-4" />
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
                    showDteSelector={true}
                    isPurchase={true}
                    existingInvoice={payingOrder.invoice_details}
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

            {invoicingOrder && (
                <DocumentRegistrationModal
                    open={!!invoicingOrder}
                    onOpenChange={(open) => !open && setInvoicingOrder(null)}
                    orderId={invoicingOrder.id}
                    orderNumber={invoicingOrder.number}
                    onSuccess={fetchOrders}
                />
            )}

            {notingOrder && (
                <PurchaseNoteModal
                    open={!!notingOrder}
                    onOpenChange={(open: boolean) => !open && setNotingOrder(null)}
                    orderId={notingOrder.id}
                    orderNumber={notingOrder.number}
                    onSuccess={fetchOrders}
                />
            )}
        </div>
    )
}
