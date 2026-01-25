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
import { OrderHubStatus } from "./components/OrderHubStatus"
import { getHubStatuses } from "@/lib/order-status-utils"
import { DataCell } from "@/components/ui/data-table-cells"
import { translateSalesChannel } from "@/lib/utils"


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
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
    'DRAFT': { label: 'Borrador', variant: 'outline' },
    'CONFIRMED': { label: 'Confirmado', variant: 'default' },
    'INVOICED': { label: 'Facturado', variant: 'secondary' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SalesOrdersPage() {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [notes, setNotes] = useState<any[]>([])
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

            await api.post('/billing/invoices/pos_checkout/', formData)

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

    const fetchNotes = async () => {
        setLoading(true)
        try {
            // Fetch only sales-related notes (linked to a sale order)
            // We assume backend filters or we filter client-side if needed.
            // Using /billing/invoices/ with dte_type filter
            const response = await api.get('/billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    sale_order__isnull: false
                }
            })
            // Filter explicitly locally if API doesn't support list filter exactly as expected
            const results = response.data.results || response.data
            // Ensure they are strictly notes and related to sales
            const salesNotes = results.filter((inv: any) =>
                ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && inv.sale_order
            )
            setNotes(salesNotes)
        } catch (error) {
            console.error("Failed to fetch notes", error)
            toast.error("Error al cargar las notas de crédito/débito.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (viewMode === 'orders') {
            fetchOrders()
        } else {
            fetchNotes()
        }
    }, [viewMode])

    const noteColumns: ColumnDef<any>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-mono font-bold text-xs">{row.original.dte_type_display}</span>
                    <span className="text-muted-foreground text-[10px]">{row.getValue("number") || '---'}</span>
                </div>
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "related_order",
            header: "Referencia",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold text-xs">NV-{row.original.sale_order_number}</span>
                    <span className="text-[10px] text-muted-foreground">{row.original.partner_name}</span>
                </div>
            )
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => (
                <DataCell.Currency value={row.getValue("total")} />
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                return (
                    <Badge variant={status === 'PAID' ? 'success' : status === 'POSTED' ? 'default' : 'secondary'}>
                        {row.original.status_display}
                    </Badge>
                )
            }
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewingTransaction({ type: 'invoice', id: row.original.id, view: 'details' })}
                >
                    <Eye className="h-4 w-4" />
                </Button>
            ),
        },
    ]

    const columns: ColumnDef<SaleOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <DataCell.Code>NV-{row.getValue("number")}</DataCell.Code>,
        },
        {
            accessorKey: "channel_display",
            header: "Canal",
            cell: ({ row }) => (
                <DataCell.Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    {translateSalesChannel(row.original.channel_display)}
                </DataCell.Badge>
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cliente" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("customer_name")}</DataCell.Text>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado Hub" />
            ),
            cell: ({ row }) => <OrderHubStatus order={row.original} />,
        },
        // Hidden columns for filtering only - these provide data for faceted filters
        {
            id: "production_status",
            accessorFn: (row) => getHubStatuses(row).production,
            header: () => null, // Don't render header
            cell: () => null, // Don't render cell
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            id: "logistics_status",
            accessorFn: (row) => getHubStatuses(row).logistics,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            id: "billing_status",
            accessorFn: (row) => getHubStatuses(row).billing,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            id: "treasury_status",
            accessorFn: (row) => getHubStatuses(row).treasury,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },

        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setSelectedOrderId(row.original.id)}
                        className="h-8 px-3 w-full"
                    >
                        <LayoutDashboard className="h-4 w-4 mr-1" />
                        Gestionar
                    </Button>
                </div>
            ),
        },
    ]

    const filteredNotes = notes.filter(note => {
        if (!dateRange || !dateRange.from) return true
        const noteDate = parseISO(note.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(noteDate, { start, end })
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4 space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Notas de Venta</h2>
                <div className="flex items-center space-x-2 pt-1">
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
                        triggerVariant="circular"
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
                    <div className="text-muted-foreground">Cargando datos...</div>
                </div>
            ) : (
                <div className="">
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                        <DataTable
                            columns={viewMode === 'orders' ? columns : noteColumns}
                            data={viewMode === 'orders' ? filteredOrders : filteredNotes}
                            filterColumn={viewMode === 'orders' ? "customer_name" : "number"} // Invoice number is a good fallback search, or partner_name if available in data
                            searchPlaceholder={viewMode === 'orders' ? "Buscar por cliente..." : "Buscar por número..."}
                            facetedFilters={viewMode === 'orders' ? [
                                {
                                    column: "status",
                                    title: "Origen",
                                    options: [
                                        { label: "Borrador", value: "DRAFT" },
                                        { label: "Confirmado", value: "CONFIRMED" },
                                        { label: "Facturado", value: "INVOICED" },
                                        { label: "Pagado", value: "PAID" },
                                        { label: "Anulado", value: "CANCELLED" },
                                    ],
                                },
                                {
                                    column: "production_status",
                                    title: "Producción",
                                    options: [
                                        { label: "En Proceso", value: "active" },
                                        { label: "Completado", value: "success" },
                                        { label: "Pendiente", value: "neutral" },
                                    ]
                                },
                                {
                                    column: "logistics_status",
                                    title: "Logística",
                                    options: [
                                        { label: "En Proceso", value: "active" },
                                        { label: "Completado", value: "success" },
                                        { label: "Pendiente", value: "neutral" },
                                    ]
                                },
                                {
                                    column: "billing_status",
                                    title: "Facturación",
                                    options: [
                                        { label: "En Proceso", value: "active" },
                                        { label: "Completado", value: "success" },
                                        { label: "Pendiente", value: "neutral" },
                                    ]
                                },
                                {
                                    column: "treasury_status",
                                    title: "Tesorería",
                                    options: [
                                        { label: "En Proceso", value: "active" },
                                        { label: "Completado", value: "success" },
                                        { label: "Pendiente", value: "neutral" },
                                    ]
                                }
                            ] : undefined}
                            useAdvancedFilter={viewMode === 'orders'}
                            onReset={() => setDateRange(undefined)}
                            toolbarAction={
                                <div className="flex items-center gap-2">
                                    <DateRangeFilter onRangeChange={setDateRange} label={viewMode === 'orders' ? "Fecha de Venta" : "Fecha de Emisión"} />
                                </div>
                            }
                            rightAction={
                                <TabsList>
                                    <TabsTrigger value="orders">Notas de Venta</TabsTrigger>
                                    <TabsTrigger value="notes">Notas Crédito/Débito</TabsTrigger>
                                </TabsList>
                            }
                            defaultPageSize={20}
                        />
                    </Tabs>
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
