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
import { Pencil, Trash2, CheckCircle, Package, FileText, History, Banknote } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Eye, FileBadge } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { DocumentRegistrationModal } from "@/components/purchasing/DocumentRegistrationModal"

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
    'CONFIRMED': { label: 'Confirmado', variant: 'info' },
}

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)


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

    const handleInvoice = async (order: PurchaseOrder) => {
        setInvoicingOrder(order)
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
                            <TableHead>Estado</TableHead>
                            <TableHead>Documentos</TableHead>
                            <TableHead className="w-[150px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">OC-{order.number}</TableCell>
                                <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                                <TableCell>{order.supplier_name}</TableCell>
                                <TableCell>{order.warehouse_name}</TableCell>
                                <TableCell>{parseFloat(order.total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</TableCell>
                                <TableCell>
                                    <Badge variant={statusMap[order.status]?.variant || "default"}>
                                        {statusMap[order.status]?.label || order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {/* Only show Invoices/Boletas as requested */}
                                        {order.related_documents?.invoices.map((inv: any) => (
                                            <button
                                                key={inv.id}
                                                onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">
                                                    {inv.type === 'BOLETA' ? 'Boleta' : 'Factura'}
                                                </span>
                                                {inv.type === 'BOLETA' ? 'BOL' : 'FACT'}-{inv.number}
                                            </button>
                                        ))}
                                        {!order.related_documents?.invoices.length && (
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
                                        {order.status === 'DRAFT' && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(order)}
                                                    title="Editar"
                                                >
                                                    <Pencil className="h-4 w-4 text-orange-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-blue-600"
                                                    onClick={() => handleConfirm(order.id)}
                                                    title="Confirmar"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(order.id)}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}

                                        {['CONFIRMED', 'RECEIVED', 'PAID', 'INVOICED'].includes(order.status) && !order.is_invoiced && (
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

            {invoicingOrder && (
                <DocumentRegistrationModal
                    open={!!invoicingOrder}
                    onOpenChange={(open) => !open && setInvoicingOrder(null)}
                    orderId={invoicingOrder.id}
                    orderNumber={invoicingOrder.number}
                    onSuccess={fetchOrders}
                />
            )}
        </div>
    )
}
