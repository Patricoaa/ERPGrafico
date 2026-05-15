"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { Button } from "@/components/ui/button"
import { ArrowRight, ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderForm } from "@/features/purchasing/components/PurchaseOrderForm"
import { toast } from "sonner"
import { DocumentRegistrationModal } from "@/features/purchasing/components/DocumentRegistrationModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { PurchaseCheckoutWizard } from "@/features/purchasing/components/PurchaseCheckoutWizard"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { format } from "date-fns"
import { DomainCard, DomainHubStatus } from "@/components/shared"
import { getHubStatuses } from "@/lib/workflow-status"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { EmptyState } from "@/components/shared/EmptyState"
import { useViewMode } from "@/hooks/useViewMode"
import { createDomainCardView, createCardLoadingView } from "@/lib/view-helpers"


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

import { usePurchasingOrders, usePurchasingNotes } from "@/features/purchasing/hooks/usePurchasing"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { purchaseOrderSearchDef } from "@/features/purchasing/searchDef"

export function PurchasingOrdersClientView({ viewMode, externalOpenCheckout, createAction }: PurchasingOrdersClientViewProps) {
    const { filters } = useSmartSearch(purchaseOrderSearchDef)
    const { orders, isLoading: isLoadingOrders, refetch: fetchOrders, deleteOrder } = usePurchasingOrders(filters)
    const { notes, isLoading: isLoadingNotes, refetch: fetchNotes } = usePurchasingNotes()

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [completingInvoice, setCompletingInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [folioModalOpen, setFolioModalOpen] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null)

    const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode('purchasing.purchaseorder')

    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()

    const toggleSelection = (id: number) => {
        const isSelected = viewMode === "orders" ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
        const params = new URLSearchParams(searchParams.toString())

        if (isSelected && isHubOpen) {
            params.delete('selected')
        } else {
            params.set('selected', String(id))
        }

        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    useEffect(() => {
        if (externalOpenCheckout) {
            setCheckoutOpen(true)
        }
    }, [externalOpenCheckout])

    const filteredOrders = orders

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteOrder(id)
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

    const filteredNotes = notes

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
                    <DomainHubStatus label="billing.invoice" data={row.original} />
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
                            onClick={() => toggleSelection(item.id)}
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
                    <DataCell.DocumentId type="purchase_order" number={row.getValue("number")} />
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
            cell: ({ row }) => <DomainHubStatus label="purchasing.purchaseorder" data={row.original} />,
            meta: { title: "Estado" },
        },

        // Hidden columns for filtering only - these provide data for faceted filters
        {
            id: "reception_status",
            accessorFn: (row) => getHubStatuses(row as any).logistics, // use generic getHubStatuses from lib
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
            accessorFn: (row) => getHubStatuses(row as any).billing,
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
            accessorFn: (row) => getHubStatuses(row as any).treasury,
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
                            onClick={() => toggleSelection(item.id)}
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

            <Tabs value={viewMode} className="w-full">
                <DataTable
                    columns={(viewMode === 'orders' ? columns : noteColumns) as any}
                    data={(viewMode === 'orders' ? filteredOrders : filteredNotes) as any}
                    onRowClick={(row: any) => toggleSelection(row.id)}
                    variant="embedded"
                    isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                    currentView={currentView}
                    onViewChange={handleViewChange}
                    viewOptions={viewOptions}
                    leftAction={<SmartSearchBar searchDef={purchaseOrderSearchDef} placeholder="Buscar por proveedor..." className="w-full" />}
                    showToolbarSort={true}
                    renderCustomView={isCustomView ? createDomainCardView(
                        viewMode === 'orders' ? 'purchasing.purchaseorder' : 'billing.invoice',
                        {
                            onRowClick: (data) => toggleSelection(data.id),
                            isSelected: (data) => viewMode === 'orders'
                                ? hubConfig?.orderId === data.id
                                : hubConfig?.invoiceId === data.id,
                            isHubOpen,
                        }
                    ) : undefined}
                    renderLoadingView={isCustomView ? createCardLoadingView('single-column') : undefined}
                    createAction={createAction}
                />
            </Tabs>

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
                        contactId={invoicingOrder?.supplier || orders.find((o: PurchaseOrder) => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === completingInvoice.id))?.supplier || undefined}
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
                        contactId={invoicingOrder?.supplier || orders.find((o: PurchaseOrder) => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === selectedInvoice.id))?.supplier || undefined}
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
