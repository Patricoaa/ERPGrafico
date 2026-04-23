"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { Button } from "@/components/ui/button"
import { List, Eye, Pencil, Trash2, ShoppingCart, Info, FileEdit, CheckCircle, Package, FileText, History, Banknote, X, FileBadge, MoreVertical, LayoutDashboard, Plus, ArrowRight, ArrowLeft, Calendar, Search, Filter, Monitor } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderForm } from "@/features/purchasing/components/PurchaseOrderForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { DocumentRegistrationModal } from "@/features/purchasing/components/DocumentRegistrationModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { PurchaseCheckoutWizard } from "@/features/purchasing/components/PurchaseCheckoutWizard"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay, format } from "date-fns"
import { PurchaseOrderHubStatus } from "@/features/orders/components/PurchaseOrderHubStatus"
import { getPurchaseHubStatuses } from '@/features/purchasing/utils/status'
import { NoteHubStatus } from "@/features/orders/components/NoteHubStatus"
import { OrderCard } from "@/features/orders/components/OrderCard"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { EmptyState } from "@/components/shared/EmptyState"


import type { Order } from "@/features/orders/types"

interface PurchaseOrder extends Order {
    supplier_name: string
    date: string
    warehouse_name: string
    supplier?: number | any
    total_paid: number
    is_invoiced: boolean
    invoice_details?: {
        dte_type: string
        number: string
        document_attachment: string | null
    } | null
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" }> = {
    'DRAFT': { label: 'Borrador', variant: 'outline' },
    'CONFIRMED': { label: 'Confirmado', variant: 'info' },
}

interface PurchasingOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
    externalOpenCheckout?: boolean
    createAction?: React.ReactNode
}

export function PurchasingOrdersClientView({ viewMode, externalOpenCheckout, createAction }: PurchasingOrdersClientViewProps) {
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [notes, setNotes] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [completingInvoice, setCompletingInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [folioModalOpen, setFolioModalOpen] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null)
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    const [currentView, setCurrentView] = useState<'card' | 'list'>('card')

    const viewOptions = [
        { label: "Lista", value: "list", icon: List },
        { label: "Tarjeta", value: "card", icon: LayoutDashboard }

    ]

    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()

    const searchParams = useSearchParams()
    const hubOpenedFromUrl = useRef(false)

    useEffect(() => {
        if (externalOpenCheckout) {
            setCheckoutOpen(true)
        }
    }, [externalOpenCheckout])

    useEffect(() => {
        const openHubStr = searchParams.get('openHub')
        if (openHubStr && !hubOpenedFromUrl.current) {
            const id = parseInt(openHubStr, 10)
            if (!isNaN(id)) {
                hubOpenedFromUrl.current = true
                openHub({ orderId: id, type: 'purchase', onActionSuccess: fetchOrders })
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

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/purchasing/orders/${id}/`)
            toast.success("Orden de Compra eliminada correctamente.")
            fetchOrders()
        } catch (error: unknown) {
            console.error("Error deleting order:", error)
            showApiError(error, "Error al eliminar la orden de compra.")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.post(`/purchasing/orders/${id}/annul/`, { force: true })
            toast.success("Orden de Compra anulada correctamente.")
            fetchOrders()
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular la orden de compra.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.post(`/purchasing/orders/${id}/annul/`, { force: false })
            toast.success("Orden de Compra anulada correctamente.")
            fetchOrders()
        } catch (error: unknown) {
            console.error("Error annulling order:", error)
            const errorMessage = getErrorMessage(error) || ""

            if (errorMessage.includes("Debe anular los pagos asociados")) {
                forceAnnulConfirm.requestConfirm(id)
                return
            }

            toast.error(errorMessage || "Error al anular la orden de compra.")
        }
    })

    const handleAnnul = (id: number) => annulConfirm.requestConfirm(id)

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
        } catch (error: unknown) {
            console.error("Error deleting invoice:", error)
            showApiError(error, "Error al eliminar el documento")
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
                ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type || '') && inv.purchase_order
            )
            setNotes(purchaseNotes as Order[])
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

    const noteColumns: ColumnDef<Order>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col items-center text-center">
                    <span className="font-bold">{row.original.dte_type_display}</span>
                </div>
            ),
            meta: { title: "Documento" },
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.DocumentId type={row.original.dte_type as any} number={row.getValue("number")} />
                </div>
            ),
            meta: { title: "Folio" },
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
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estados" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <NoteHubStatus note={row.original} />
                </div>
            ),
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
            id: "hub_trigger",
            header: () => null,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.invoiceId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={() => {
                                if (isSelected && isHubOpen) {
                                    closeHub()
                                } else {
                                    openHub({ orderId: null, invoiceId: item.id, type: 'purchase', onActionSuccess: fetchNotes })
                                }
                            }}
                        >
                            {isSelected && isHubOpen ? (
                                <ArrowLeft className="h-4 w-4 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                            ) : (
                                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            )}
                        </Button>
                    </div>
                )
            },
        },
    ]

    const columns: ColumnDef<PurchaseOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.DocumentId type="PURCHASE_ORDER" number={row.getValue("number")} />
                </div>
            ),
            meta: { title: "Folio" },
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
                <DataTableColumnHeader column={column} title="Estados" />
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
            id: "hub_trigger",
            header: () => null,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.orderId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={() => {
                                if (isSelected) {
                                    closeHub()
                                } else {
                                    openHub({ orderId: item.id, type: 'purchase', onActionSuccess: fetchOrders })
                                }
                            }}
                        >
                            {isSelected && isHubOpen ? (
                                <ArrowLeft className="h-4 w-4 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                            ) : (
                                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            )}
                        </Button>
                    </div>
                )
            },
        },
    ]

    const filteredNotes = notes.filter(note => {
        if (!dateRange || !dateRange.from) return true
        const noteDate = parseISO(note.date || new Date().toISOString())
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(noteDate, { start, end })
    })

    return (
        <div className="space-y-6">
            {editingOrder && (
                <PurchaseOrderForm
                    initialData={editingOrder as unknown as any}
                    open={!!editingOrder}
                    onOpenChange={(open) => {
                        if (!open) setEditingOrder(null)
                    }}
                    onSuccess={fetchOrders}
                />
            )}

            {loading ? (
                <LoadingFallback variant="list" className="pt-2" />
            ) : (
                <Tabs value={viewMode} className="w-full">
                    <DataTable
                    columns={(viewMode === 'orders' ? columns : noteColumns) as any}
                    data={(viewMode === 'orders' ? filteredOrders : filteredNotes) as any}
                    onRowClick={(row: any) => {
                            const isSelected = viewMode === "orders" ? hubConfig?.orderId === row.id : hubConfig?.invoiceId === row.id
                            if (isSelected && isHubOpen) {
                                closeHub()
                            } else {
                                if (viewMode === "orders") {
                                    openHub({ orderId: row.id, type: 'purchase', onActionSuccess: fetchOrders })
                                } else {
                                    openHub({ orderId: null, invoiceId: row.id, type: 'purchase', onActionSuccess: fetchNotes })
                                }
                            }
                        }}
                        cardMode={true}
                        currentView={currentView}
                        onViewChange={(v: string) => setCurrentView(v as 'card' | 'list')}
                        viewOptions={viewOptions}
                        filterColumn={viewMode === 'orders' ? "supplier_name" : "number"}
                        searchPlaceholder={viewMode === 'orders' ? "Buscar por proveedor..." : "Buscar por folio..."}
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
                        globalFilterFields={["number"]}
                        isCustomFiltered={!!dateRange}
                        customFilterCount={dateRange ? 1 : 0}
                        customFilters={
                            <DateRangeFilter
                                onRangeChange={setDateRange}
                                label={viewMode === 'orders' ? "Fecha de Orden" : "Fecha de Emisión"}
                                className="bg-transparent border-none w-full"
                            />
                        }
                        renderCustomView={currentView === 'card' ? (table) => {
                            const rows = table.getRowModel().rows
                            if (rows.length === 0) {
                                return (
                                    <EmptyState
                                        context="inventory"
                                        title={viewMode === 'orders' ? "Sin Órdenes de Compra" : "Sin Notas Registradas"}
                                        description={viewMode === 'orders'
                                            ? "No se han encontrado órdenes de compra en este periodo."
                                            : "No hay notas de crédito ni débito asociadas a tus compras."
                                        }

                                        className="py-24"
                                    />
                                )
                            }
                            return (
                                <div className="grid gap-3 pt-2">
                                    {rows.map((row: import("@tanstack/react-table").Row<any>) => {
                                        const item = row.original
                                        const isSelected = viewMode === 'orders'
                                            ? hubConfig?.orderId === item.id
                                            : hubConfig?.invoiceId === item.id

                                        return (
                                            <OrderCard
                                                key={item.id}
                                                item={item}
                                                isSelected={isSelected}
                                                type={viewMode === 'orders' ? 'purchase' : 'note'}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        closeHub()
                                                    } else if (viewMode === 'orders') {
                                                        openHub({ orderId: item.id, type: 'purchase', onActionSuccess: fetchOrders })
                                                    } else {
                                                        openHub({ orderId: null, invoiceId: item.id, type: 'purchase', onActionSuccess: fetchNotes })
                                                    }
                                                }}
                                            />
                                        )
                                    })}
                                </div>
                            )
                        } : undefined}
                        createAction={createAction}
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
                        supplierId={invoicingOrder.supplier}
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
                        contactId={invoicingOrder?.supplier || orders.find(o => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === completingInvoice.id))?.supplier || undefined}
                        isPurchase={true}
                        onComplete={async (invoiceId, formData) => {
                            await api.post(`/billing/invoices/${invoiceId}/confirm/`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            })
                        }}
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
                orderLines={[{ product: "", product_name: "", quantity: 1, uom: "", uom_name: "", unit_cost: 0, tax_rate: 19 } as any]}
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
                        contactId={invoicingOrder?.supplier || orders.find(o => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === selectedInvoice.id))?.supplier || undefined}
                        isPurchase={true}
                        onComplete={async (invoiceId, formData) => {
                            await api.post(`/billing/invoices/${invoiceId}/confirm/`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            })
                        }}
                        onSuccess={fetchOrders}
                    />
                )
            }

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Orden de Compra"
                description="¿Está seguro de que desea eliminar esta Orden de Compra? Esta acción no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={annulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) annulConfirm.cancel() }}
                onConfirm={annulConfirm.confirm}
                title="Anular Documento"
                description="¿Está seguro de que desea ANULAR esta Orden de Compra? Esta acción generará reversos contables y liberará reservas, y no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={forceAnnulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }}
                onConfirm={forceAnnulConfirm.confirm}
                title="Desvincular y Anular Pagos"
                description="Este documento (o sus facturas) tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?"
                variant="destructive"
            />
        </div>
    )
}
