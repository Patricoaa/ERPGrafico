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
import { Eye, Pencil, Trash2, ShoppingCart, Info, FileEdit, CheckCircle, Package, FileText, History, Banknote, X, FileBadge } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { DocumentRegistrationModal } from "@/components/purchasing/DocumentRegistrationModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { PurchaseCheckoutWizard } from "@/components/purchasing/PurchaseCheckoutWizard"

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
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [completingInvoice, setCompletingInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [folioModalOpen, setFolioModalOpen] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<{ id: number, type: string } | null>(null)


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
        } catch (error: any) {
            console.error("Error deleting order:", error)
            toast.error(error.response?.data?.error || "Error al eliminar la orden de compra.")
        }
    }

    const handleAnnul = async (id: number, force: boolean = false) => {
        if (!force && !confirm("¿Está seguro de que desea ANULAR esta Orden de Compra? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/purchasing/orders/${id}/annul/`, { force })
            toast.success("Orden de Compra anulada correctamente.")
            fetchOrders()
        } catch (error: any) {
            console.error("Error annulling order:", error)
            const errorMessage = error.response?.data?.error || ""

            if (errorMessage.includes("Debe anular los pagos asociados") && !force) {
                if (confirm("Este documento (o sus facturas) tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?")) {
                    handleAnnul(id, true)
                    return
                }
            }

            toast.error(errorMessage || "Error al anular la orden de compra.")
        }
    }

    const handleEdit = async (order: PurchaseOrder) => {
        try {
            const response = await api.get(`/purchasing/orders/${order.id}/`)
            setEditingOrder(response.data)
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

    const handleDeleteInvoice = async (invoiceId: number) => {
        try {
            await api.delete(`/billing/invoices/${invoiceId}/`)
            toast.success("Documento eliminado correctamente")
            fetchOrders()
        } catch (error: any) {
            console.error("Error deleting invoice:", error)
            toast.error(error.response?.data?.error || "Error al eliminar el documento")
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
                    <Button onClick={() => setCheckoutOpen(true)}>
                        Nueva Orden de Compra
                    </Button>
                    {editingOrder && (
                        <PurchaseOrderForm
                            initialData={editingOrder}
                            open={!!editingOrder}
                            onOpenChange={(open) => {
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
                                    <Badge variant={order.status === 'DRAFT' ? 'outline' : 'info'}>
                                        {order.status === 'DRAFT' ? 'Borrador' : 'Confirmado'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {/* Only show Invoices/Boletas as requested */}
                                        {order.related_documents?.invoices?.map((inv: any) => (
                                            <div key={inv.id} className="flex items-center gap-2 group">
                                                <button
                                                    onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                                                    className={`text-[10px] flex flex-col text-left items-start leading-tight ${inv.status === 'DRAFT' ? 'text-amber-600' : 'text-blue-600 hover:underline'}`}
                                                >
                                                    <span className="font-semibold uppercase text-[8px] text-muted-foreground">
                                                        {inv.type === 'BOLETA' ? 'Boleta' : 'Factura'}
                                                    </span>
                                                    {inv.status === 'DRAFT' ? '(Pendiente)' : `${inv.type === 'BOLETA' ? 'BOL' : 'FACT'}-${inv.number}`}
                                                </button>
                                                {inv.status === 'DRAFT' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            setSelectedInvoice({ id: inv.id, type: inv.type })
                                                            setFolioModalOpen(true)
                                                        }}
                                                        title="Registrar Folio"
                                                    >
                                                        <FileEdit className="h-3 w-3 text-amber-600" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        {!order.related_documents?.invoices?.length && (
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

                                        {/* Complete Folio for Draft Invoices */}
                                        {order.related_documents?.invoices?.some((inv: any) => inv.status === 'DRAFT') && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-amber-600"
                                                    onClick={() => {
                                                        const draftInv = order.related_documents?.invoices?.find((inv: any) => inv.status === 'DRAFT')
                                                        if (draftInv) setCompletingInvoice({ id: draftInv.id, type: draftInv.type })
                                                    }}
                                                    title="Completar Folio"
                                                >
                                                    <FileEdit className="h-4 w-4" />
                                                </Button>
                                                {/* Delete Draft Invoice */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive"
                                                    onClick={() => {
                                                        const inv = order.related_documents?.invoices?.[0]
                                                        if (inv && confirm(`¿Está seguro de eliminar ${inv.type === 'BOLETA' ? 'la Boleta' : 'la Factura'} ${inv.number || '(Pendiente)'}?`)) {
                                                            handleDeleteInvoice(inv.id)
                                                        }
                                                    }}
                                                    title="Eliminar Documento"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}

                                        {order.status === 'DRAFT' ? (
                                            !order.related_documents?.invoices?.length && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(order.id)}
                                                    title="Eliminar Orden de Compra"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )
                                        ) : order.status !== 'CANCELLED' ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleAnnul(order.id)}
                                                title="Anular"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : null}
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

            {completingInvoice && (
                <DocumentCompletionModal
                    open={!!completingInvoice}
                    onOpenChange={(open) => !open && setCompletingInvoice(null)}
                    invoiceId={completingInvoice.id}
                    invoiceType={completingInvoice.type}
                    onSuccess={fetchOrders}
                />
            )}

            <PurchaseCheckoutWizard
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                order={null}
                orderLines={[{ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }]}
                total={0}
                onComplete={() => {
                    fetchOrders()
                    setCheckoutOpen(false)
                }}
            />

            {selectedInvoice && (
                <DocumentCompletionModal
                    open={folioModalOpen}
                    onOpenChange={setFolioModalOpen}
                    invoiceId={selectedInvoice.id}
                    invoiceType={selectedInvoice.type}
                    onSuccess={fetchOrders}
                />
            )}
        </div>
    )
}
