"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Eye, FileText, CheckCircle, Banknote, Truck, History, FileBadge, FileEdit, X, MoreVertical, LayoutDashboard } from "lucide-react"
import api from "@/lib/api"
import { SaleOrderForm } from "@/components/forms/SaleOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { SalesCheckoutWizard } from "@/components/sales/SalesCheckoutWizard"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { DeliveryModal } from "@/components/sales/DeliveryModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { SaleNoteModal } from "@/components/sales/SaleNoteModal"
import { Progress } from "@/components/ui/progress"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"


interface SaleOrder {
    id: number
    number: string
    customer_name: string
    date: string
    status: string
    total: string
    total_paid: number
    pending_amount: number
    customer: number
    channel_display: string
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED'
    has_pending_work_orders?: boolean
    related_documents?: {
        invoices: any[]
        notes: any[]
        payments: any[]
        deliveries: any[]
    }
    lines?: any[]
    command_center_status?: {
        label: string
        variant: string
    }
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
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [payingOrder, setPayingOrder] = useState<SaleOrder | null>(null)
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null)
    const [completingFolio, setCompletingFolio] = useState<SaleOrder | null>(null)
    const [addingNote, setAddingNote] = useState<SaleOrder | null>(null)
    const [checkoutData, setCheckoutData] = useState<any | null>(null)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

    const filteredOrders = orders.filter(order => {
        if (!dateRange || !dateRange.from) return true

        const orderDate = parseISO(order.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)

        return isWithinInterval(orderDate, { start, end })
    })

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
        } catch (error: any) {
            console.error("Error deleting order:", error)
            toast.error(error.response?.data?.error || "Error al eliminar la nota de venta.")
        }
    }

    const handleAnnul = async (id: number, force: boolean = false) => {
        if (!force && !confirm("¿Está seguro de que desea ANULAR esta Nota de Venta? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/sales/orders/${id}/annul/`, { force })
            toast.success("Nota de Venta anulada correctamente.")
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

            toast.error(errorMessage || "Error al anular la nota de venta.")
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
        is_pending_registration?: boolean,
        documentReference?: string,
        documentDate?: string,
        documentAttachment?: File | null,
        treasury_account_id?: string | null
    }) => {
        if (!payingOrder) return
        try {
            const formData = new FormData()
            formData.append('order_data', JSON.stringify({
                id: payingOrder.id,
                customer: payingOrder.customer,
            }))
            formData.append('dte_type', data.dteType || 'BOLETA')
            formData.append('payment_method', data.paymentMethod)
            formData.append('amount', data.amount.toString())

            if (data.transaction_number) formData.append('transaction_number', data.transaction_number)
            if (data.is_pending_registration !== undefined) formData.append('is_pending_registration', data.is_pending_registration.toString())
            if (data.treasury_account_id) formData.append('treasury_account_id', data.treasury_account_id)
            if (data.documentReference) formData.append('document_number', data.documentReference)
            if (data.documentDate) formData.append('document_date', data.documentDate)
            if (data.documentAttachment) formData.append('document_attachment', data.documentAttachment)

            await api.post('/billing/invoices/pos_checkout/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            toast.success("Operación procesada correctamente")
            setPayingOrder(null)
            fetchOrders()

            // If it was a pending registration, maybe prompt something or just refresh
            if (data.is_pending_registration) {
                toast.info("El pago se registró, pero el documento quedó pendiente de folio.")
            }
        } catch (error: any) {
            console.error("Error in handlePayment:", error)
            toast.error(error.response?.data?.error || "Error al procesar el pago")
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    const columns: ColumnDef<SaleOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <div className="font-medium">NV-{row.getValue("number")}</div>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <div>{new Date(row.getValue("date")).toLocaleDateString()}</div>,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cliente" />
            ),
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => <div>{parseFloat(row.getValue("total")).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</div>,
        },
        {
            id: "paid",
            header: "Pagado",
            cell: ({ row }) => {
                const total = parseFloat(row.original.total)
                const paid = row.original.total_paid
                const percentage = total > 0 ? (paid / total) * 100 : 0
                return (
                    <div className="space-y-1 w-32">
                        <div className="flex justify-between text-[10px] font-bold">
                            <span>{Math.round(percentage)}%</span>
                            <span>${paid.toLocaleString()}</span>
                        </div>
                        <Progress value={percentage} className="h-1" />
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                return (
                    <Badge variant={statusMap[status]?.variant || "default"}>
                        {statusMap[status]?.label || status}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "channel_display",
            header: "Canal",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-[10px] uppercase">
                    {row.getValue("channel_display")}
                </Badge>
            ),
        },
        {
            id: "documents",
            header: "Documentos",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    {row.original.related_documents?.invoices.map((inv: any) => (
                        <button
                            key={inv.id}
                            onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                            className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                        >
                            <span className="font-semibold uppercase text-[8px] text-muted-foreground">Factura</span>
                            {inv.type === 'BOLETA' ? 'BOL' : 'FACT'}-{inv.number}
                        </button>
                    ))}
                    {row.original.related_documents?.payments?.map((pay: any) => (
                        <button
                            key={pay.id}
                            onClick={() => setViewingTransaction({ type: 'payment', id: pay.id, view: 'details' })}
                            className="text-emerald-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                        >
                            <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">Pago</span>
                            <span className="text-[10px] font-mono">{pay.code}</span>
                        </button>
                    ))}
                    {!row.original.related_documents?.invoices.length && !row.original.related_documents?.payments.length && (
                        <span className="text-muted-foreground text-xs">-</span>
                    )}
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <Button
                        variant={row.original.command_center_status?.variant === 'success' ? 'default' :
                            row.original.command_center_status?.variant === 'destructive' ? 'destructive' :
                                row.original.command_center_status?.variant === 'active' ? 'secondary' : 'outline'
                        }
                        size="sm"
                        onClick={() => setSelectedOrderId(row.original.id)}
                        className={cn(
                            "h-8 px-3 w-full border font-semibold",
                            row.original.command_center_status?.variant === 'success' && "bg-green-600 hover:bg-green-700 text-white border-green-700",
                            row.original.command_center_status?.variant === 'active' && "bg-blue-600 hover:bg-blue-700 text-white border-blue-700",
                            row.original.command_center_status?.variant === 'destructive' && "bg-red-600 hover:bg-red-700 text-white border-red-700",
                        )}
                    >
                        <LayoutDashboard className="h-4 w-4 mr-1.5" />
                        {row.original.command_center_status?.label || 'Gestionar'}
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Notas de Venta</h2>
                <div className="flex items-center space-x-2">
                    <SaleOrderForm
                        onConfirmCheckout={(data) => {
                            setCheckoutData(data)
                            setIsFormOpen(false)
                        }}
                        open={isFormOpen && !editingOrder}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) {
                                setEditingOrder(null)
                            }
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
            {loading ? (
                <div className="flex items-center justify-between h-64 justify-center">
                    <div className="text-muted-foreground">Cargando notas de venta...</div>
                </div>
            ) : (
                <div className="">
                    <DataTable
                        columns={columns}
                        data={filteredOrders}
                        filterColumn="customer_name"
                        searchPlaceholder="Buscar por cliente..."
                        facetedFilters={[
                            {
                                column: "status",
                                title: "Estado",
                                options: [
                                    { label: "Borrador", value: "DRAFT" },
                                    { label: "Confirmado", value: "CONFIRMED" },
                                    { label: "Facturado", value: "INVOICED" },
                                    { label: "Pagado", value: "PAID" },
                                    { label: "Anulado", value: "CANCELLED" },
                                ],
                            },
                        ]}
                        toolbarAction={
                            <DateRangeFilter onRangeChange={setDateRange} label="Fecha de Venta" />
                        }
                        defaultPageSize={20}
                    />
                </div>
            )}


            {
                viewingTransaction && (
                    <TransactionViewModal
                        open={!!viewingTransaction}
                        onOpenChange={(open) => !open && setViewingTransaction(null)}
                        type={viewingTransaction.type}
                        id={viewingTransaction.id}
                        view={viewingTransaction.view}
                    />
                )
            }

            {
                (payingOrder || checkoutData) && (
                    <SalesCheckoutWizard
                        open={!!payingOrder || !!checkoutData}
                        onOpenChange={(open) => {
                            if (!open) {
                                setPayingOrder(null)
                                setCheckoutData(null)
                            }
                        }}
                        order={payingOrder}
                        orderLines={payingOrder ? (payingOrder.lines || []).map((l: any) => ({
                            ...l,
                            id: l.product, // Salesforce expects product ID in 'id' field for new orders
                            product_name: l.product_name || l.description,
                            name: l.product_name || l.description, // Mapped for Step2
                            code: l.product_code, // Mapped for Step2
                            qty: l.quantity,
                            unit_price_net: l.unit_price,
                            uom: l.uom,
                            uom_name: l.uom_name,
                            manufacturing_data: l.manufacturing_data
                        })) : (checkoutData?.lines?.map((l: any) => ({
                            ...l,
                            id: l.product, // Salesforce expects product ID in 'id' field for new orders
                            product_name: l.product_name || l.description,
                            name: l.product_name || l.description, // Mapped for Step2
                            code: l.product_code || l.code,
                            qty: l.quantity,
                            unit_price_net: l.unit_price,
                            uom: l.uom,
                            uom_name: l.uom_name,
                            manufacturing_data: l.manufacturing_data
                        })) || [])}
                        total={payingOrder ? parseFloat(payingOrder.total) : (checkoutData?.lines?.reduce((sum: number, l: any) => {
                            const net = l.quantity * (l.unit_price || 0);
                            const tax = net * ((l.tax_rate || 19) / 100);
                            return sum + net + tax;
                        }, 0) || 0)}
                        initialCustomerId={payingOrder?.customer?.toString()}
                        initialCustomerName={payingOrder?.customer_name}
                        channel={checkoutData ? "SALE" : "POS"}
                        onComplete={fetchOrders}
                    />
                )
            }

            {
                dispatchingOrder && (
                    <DeliveryModal
                        open={!!dispatchingOrder}
                        onOpenChange={(open) => !open && setDispatchingOrder(null)}
                        orderId={dispatchingOrder}
                        onSuccess={fetchOrders}
                    />
                )
            }

            {
                completingFolio && (
                    <DocumentCompletionModal
                        open={!!completingFolio}
                        onOpenChange={(open) => !open && setCompletingFolio(null)}
                        invoiceId={completingFolio.related_documents?.invoices?.find((inv: any) => inv.number === 'Draft')?.id || completingFolio.related_documents?.invoices?.[0]?.id}
                        invoiceType={completingFolio.related_documents?.invoices?.find((inv: any) => inv.number === 'Draft')?.type || "BOLETA"}
                        onSuccess={fetchOrders}
                    />
                )
            }

            {
                addingNote && (
                    <SaleNoteModal
                        open={!!addingNote}
                        onOpenChange={(open) => !open && setAddingNote(null)}
                        orderId={addingNote.id}
                        orderNumber={addingNote.number}
                        invoiceId={addingNote.related_documents?.invoices?.[0]?.id}
                        onSuccess={fetchOrders}
                    />
                )
            }

            <OrderCommandCenter
                orderId={selectedOrderId}
                type="sale"
                open={selectedOrderId !== null}
                onOpenChange={(open) => !open && setSelectedOrderId(null)}
                onActionSuccess={fetchOrders}
            />
        </div >
    )
}
