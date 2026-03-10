"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { Button } from "@/components/ui/button"
import { Eye, Pencil, Trash2, ShoppingCart, Info, FileEdit, CheckCircle, Package, FileText, History, Banknote, X, FileBadge, MoreVertical, LayoutDashboard, Plus, ArrowRight, Calendar, Search, Filter } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { DocumentRegistrationModal } from "@/components/purchasing/DocumentRegistrationModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { PurchaseCheckoutWizard } from "@/components/purchasing/PurchaseCheckoutWizard"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay, format } from "date-fns"
import { es } from "date-fns/locale"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { PurchaseOrderHubStatus } from "@/components/orders/PurchaseOrderHubStatus"
import { getPurchaseHubStatuses } from "@/lib/purchase-order-status-utils"
import { NoteHubStatus } from "@/components/orders/NoteHubStatus"
import { OrderCard } from "@/components/orders/OrderCard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatPlainDate } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

interface PurchasingOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
}

export function PurchasingOrdersClientView({ viewMode }: PurchasingOrdersClientViewProps) {
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [notes, setNotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [completingInvoice, setCompletingInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [folioModalOpen, setFolioModalOpen] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<{ id: number, type: string } | null>(null)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
    const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null)
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    
    const searchParams = useSearchParams()
    const hubOpenedFromUrl = useRef(false)

    useEffect(() => {
        const openHubStr = searchParams.get('openHub')
        if (openHubStr && !hubOpenedFromUrl.current) {
            const id = parseInt(openHubStr, 10)
            if (!isNaN(id)) {
                hubOpenedFromUrl.current = true
                setSelectedOrderId(id)
            }
        }
    }, [searchParams])

    const filteredOrders = orders.filter(order => {
        if (!dateRange || !dateRange.from) return true

        const orderDate = parseISO(order.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)

        return isWithinInterval(orderDate, { start, end })
    })


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

    const fetchNotes = async () => {
        setLoading(true)
        try {
            const response = await api.get('/billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    purchase_order__isnull: false
                }
            })
            const results = response.data.results || response.data
            // Ensure they are strictly notes and related to purchases
            const purchaseNotes = results.filter((inv: any) =>
                ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && inv.purchase_order
            )
            setNotes(purchaseNotes)
        } catch (error) {
            console.error("Failed to fetch notes", error)
            toast.error("Error al cargar las notas.")
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
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <span className="font-mono font-bold text-xs">{row.original.dte_type_display}</span>
            ),
            meta: { title: "Documento" },
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-muted-foreground text-[10px] sm:text-xs">
                        {row.getValue("number") ? (row.original.dte_type === 'NOTA_CREDITO' ? 'NC-' : 'ND-') + row.getValue("number") : '---'}
                    </span>
                </div>
            ),
            meta: { title: "Número" },
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
            meta: { title: "Fecha" },
        },
        {
            accessorKey: "supplier_name", // Try supplier_name, fallback to partner_name
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.original.supplier_name || row.original.partner_name}</DataCell.Text>,
            meta: { title: "Proveedor" },
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => (
                <DataCell.Currency value={row.getValue("total")} />
            ),
            meta: { title: "Total" },
        },
        {
            id: "status_hub",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado Hub" />
            ),
            cell: ({ row }) => <NoteHubStatus note={row.original} />,
            meta: { title: "Estado" },
        },
        // Filters for Notes (Hidden)
        {
            id: "status",
            accessorFn: (row) => row.status,
            header: () => null,
            cell: () => null,
            enableHiding: false,
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setSelectedInvoiceId(row.original.id)}
                        className="h-8 px-3 w-full"
                    >
                        <LayoutDashboard className="h-4 w-4 mr-1" />
                        Gestionar
                    </Button>
                </div>
            ),
        },
    ]

    const columns: ColumnDef<PurchaseOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <DataCell.Code>OCS-{row.getValue("number")}</DataCell.Code>,
            meta: { title: "Número" },
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
            meta: { title: "Fecha" },
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("supplier_name")}</DataCell.Text>,
            meta: { title: "Proveedor" },
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Almacén" />
            ),
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("warehouse_name")}</DataCell.Secondary>,
            meta: { title: "Almacén" },
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
            meta: { title: "Total" },
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado Hub" />
            ),
            cell: ({ row }) => <PurchaseOrderHubStatus order={row.original} />,
            meta: { title: "Estado" },
        },

        // Hidden columns for filtering only - these provide data for faceted filters
        {
            id: "reception_status",
            accessorFn: (row) => getPurchaseHubStatuses(row).reception,
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
            accessorFn: (row) => getPurchaseHubStatuses(row).billing,
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
            accessorFn: (row) => getPurchaseHubStatuses(row).treasury,
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
        <div className="space-y-6">
            <PageHeader
                title="Gestión de Compras"
                description="Gestión integral de órdenes de compra, recepciones y facturas de proveedores"

                titleActions={
                    <PageHeaderButton
                        onClick={() => setCheckoutOpen(true)}
                        icon={Plus}
                        circular
                        title="Nueva Orden"
                    />
                }
            >
                <div className="flex items-center gap-2">
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
            </PageHeader>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando datos...</div>
                </div>
            ) : (
                <Tabs value={viewMode} className="w-full">
                    <DataTable
                        columns={viewMode === 'orders' ? columns : noteColumns}
                        data={viewMode === 'orders' ? filteredOrders : filteredNotes}
                        filterColumn={viewMode === 'orders' ? "supplier_name" : "number"}
                        searchPlaceholder={viewMode === 'orders' ? "Buscar por proveedor..." : "Buscar por número..."}
                        facetedFilters={[
                            {
                                column: "status",
                                title: "Origen",
                                options: viewMode === 'orders' ? [
                                    { label: "Borrador", value: "DRAFT" },
                                    { label: "Confirmado", value: "CONFIRMED" },
                                ] : [
                                    { label: "Borrador", value: "DRAFT" },
                                    { label: "Publicado", value: "POSTED" },
                                    { label: "Pagado", value: "PAID" },
                                    { label: "Anulado", value: "CANCELLED" },
                                ],
                            },
                            ...(viewMode === 'orders' ? [
                                {
                                    column: "reception_status",
                                    title: "Recepción",
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
                            ] : [])
                        ]}
                        useAdvancedFilter={true}
                        showToolbarSort={true}
                        onReset={() => setDateRange(undefined)}
                        toolbarAction={
                            <div className="flex items-center gap-2">
                                <DateRangeFilter onRangeChange={setDateRange} label={viewMode === 'orders' ? "Fecha de Orden" : "Fecha de Emisión"} />
                            </div>
                        }
                        globalFilterFields={["number"]}
                        showToolbarSort={true}
                        renderCustomView={(table) => {
                            const rows = table.getRowModel().rows
                            if (rows.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-3xl border-2 border-dashed">
                                        <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                        <p className="text-muted-foreground font-medium">No se encontraron resultados</p>
                                    </div>
                                )
                            }
                            return (
                                <div className="grid gap-3 pt-2">
                                    {rows.map((row: any) => {
                                        const item = row.original
                                        return (
                                            <OrderCard
                                                key={item.id}
                                                item={item}
                                                type={viewMode === 'orders' ? 'purchase' : 'note'}
                                                onClick={() => {
                                                    if (viewMode === 'orders') {
                                                        setSelectedOrderId(item.id)
                                                    } else {
                                                        setSelectedInvoiceId(item.id)
                                                    }
                                                }}
                                            />
                                        )
                                    })}
                                </div>
                            )
                        }}
                    />
                </Tabs>
            )}

            {viewingTransaction && (
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
                invoicingOrder && (
                    <DocumentRegistrationModal
                        open={!!invoicingOrder}
                        onOpenChange={(open) => !open && setInvoicingOrder(null)}
                        orderId={invoicingOrder.id}
                        orderNumber={invoicingOrder.number}
                        onSuccess={fetchOrders}
                    />
                )
            }

            {
                completingInvoice && (
                    <DocumentCompletionModal
                        open={!!completingInvoice}
                        onOpenChange={(open) => !open && setCompletingInvoice(null)}
                        invoiceId={completingInvoice.id}
                        invoiceType={completingInvoice.type}
                        onSuccess={fetchOrders}
                    />
                )
            }

            <PurchaseCheckoutWizard
                open={checkoutOpen || !!checkoutOrderId}
                onOpenChange={(open) => {
                    setCheckoutOpen(open)
                    if (!open) setCheckoutOrderId(null)
                }}
                order={null}
                orderId={checkoutOrderId}
                orderLines={[{ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }]}
                total={0}
                onComplete={() => {
                    fetchOrders()
                    setCheckoutOpen(false)
                    setCheckoutOrderId(null)
                }}
            />

            {
                selectedInvoice && (
                    <DocumentCompletionModal
                        open={folioModalOpen}
                        onOpenChange={setFolioModalOpen}
                        invoiceId={selectedInvoice.id}
                        invoiceType={selectedInvoice.type}
                        onSuccess={fetchOrders}
                    />
                )
            }

            <OrderCommandCenter
                orderId={selectedOrderId}
                invoiceId={selectedInvoiceId}
                type="purchase"
                open={selectedOrderId !== null || selectedInvoiceId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOrderId(null)
                        setSelectedInvoiceId(null)
                    }
                }}
                onActionSuccess={fetchOrders}
                onEdit={(id) => {
                    setSelectedOrderId(null)
                    setCheckoutOrderId(id)
                }}
            />
        </div>
    )
}
