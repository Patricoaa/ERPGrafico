"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useEffect, useState, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ActionConfirmModal, DataTableView, DocumentCompletionModal, DomainHubStatus, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from '@/components/shared'
import { DataTableColumnHeader, DataCell } from '@/components/shared'
import type { AnalyticsPanelConfig } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowRight, ArrowLeft, BarChart3, Building2, DollarSign, Wallet, CreditCard, ShoppingBag, Hash } from "lucide-react"
import api from "@/lib/api"
import { PurchaseOrderModal, DocumentRegistrationModal, PurchaseCheckoutWizard, usePurchasingOrders, usePurchasingNotes, purchaseOrderSearchDef, usePurchasingAnalyticsData } from "@/features/purchasing"
import { purchaseOrderSegDef } from "@/features/purchasing/segmentationDef"
import type { PurchaseOrderAPI } from "@/features/purchasing"
import { toast } from "sonner"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { getHubStatuses } from "@/lib/workflow-status"
import { useVatRate } from '@/hooks/useVatRate'
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { Tabs } from "@/components/ui/tabs"

import type { Order } from "@/features/orders"
import type { Invoice } from "@/features/billing"

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

interface PurchasingOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
    externalOpenCheckout?: boolean
    createAction?: React.ReactNode
    initialOrders?: PurchaseOrderAPI[]
    initialNotes?: Invoice[]
}

export function PurchasingOrdersClientView({ viewMode, externalOpenCheckout, createAction, initialOrders, initialNotes }: PurchasingOrdersClientViewProps) {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(purchaseOrderSearchDef)
    const basePeriod = { serverParamFrom: 'date_after', serverParamTo: 'date_before' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(purchaseOrderSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = { ...textFilters, ...segFilters }
    const { orders, isLoading: isLoadingOrders, isRefetching, refetch: fetchOrders, deleteOrder } = usePurchasingOrders(allFilters, initialOrders)
    const { notes, isLoading: isLoadingNotes } = usePurchasingNotes(initialNotes)

    const { rate } = useVatRate()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [completingInvoice, setCompletingInvoice] = useState<{ id: number, type: string } | null>(null)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [folioModalOpen, setFolioModalOpen] = useState(false)
    const [selectedInvoice] = useState<{ id: number, type: string } | null>(null)

    const { hubConfig, isHubOpen } = useHubPanel()
    const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null)
    const [granularity, setGranularity] = useState<"day" | "month" | "year">("month")
    const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)

    const analyticsData = usePurchasingAnalyticsData(orders as PurchaseOrderAPI[], dateRange, granularity)

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => {
        if (viewMode !== "orders") return { screen: { entityName: "", tabs: [] } }

        const lineData = [
            {
                id: "Total",
                data: analyticsData.monthlyVolume.map((m) => ({ x: m.month, y: m.total })),
            },
            {
                id: "Promedio",
                data: analyticsData.monthlyAvg.map((m) => ({ x: m.month, y: m.avg })),
            },
        ]

        return {
            screen: {
                entityName: "Órdenes de Compra",
                granularity,
                onGranularityChange: setGranularity,
                dateRange,
                onDateRangeChange: setDateRange,
                tabs: [
                    // ── Tab 1: Financiero ──────────────────────────────
                    {
                        value: "financiero",
                        label: "Financiero",
                        icon: BarChart3,
                        columns: [
                            {
                                id: "col-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "combo-chart",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Volumen de Órdenes",
                                                variant: "chart",
                                                chart: {
                                                        type: "line-chart",
                                                        data: lineData,
                                                        enableArea: true,
                                                        showLegend: true,
                                                        valueFormat: "$,.0f",
                                                        axisBottomLegend: "Período",
                                                        axisLeftLegend: "Monto ($)",
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-payment",
                                weight: 1,
                                sections: [
                                    {
                                        id: "payment-chart",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Forma de Pago",
                                                variant: "chart",
                                                chart: {
                                                        type: "pie-chart",
                                                        data: analyticsData.paymentMethodDistribution,
                                                        showLegend: true,
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },

                    // ── Tab 2: Abastecimiento ──────────────────────────
                    {
                        value: "abastecimiento",
                        label: "Abastecimiento",
                        icon: Building2,
                        columns: [
                            {
                                id: "col-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "top-suppliers",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Top Proveedores",
                                                variant: "chart",
                                                chart: {
                                                        type: "bar-chart",
                                                        data: analyticsData.topSuppliers,
                                                        keys: ["total"],
                                                        indexBy: "supplier",
                                                        valueFormat: "~s",
                                                        axisBottomLegend: "Proveedor",
                                                        axisLeftLegend: "Monto ($)",
                                                        lineOverlay: {
                                                            dataKey: "orderCount",
                                                            label: "Cantidad Órdenes",
                                                            color: "#22c55e",
                                                        },
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-logistics",
                                weight: 1,
                                sections: [
                                    {
                                        id: "receiving-status",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Entregas a Tiempo",
                                                variant: "metric-chart",
                                                value: `${analyticsData.onTimeCount}`,
                                                subtext: `${analyticsData.lateCount} con retraso · ${analyticsData.pendingReceiptCount} pendientes · ${analyticsData.overdueCount} vencidas`,
                                                chart: {
                                                        type: "pie-chart",
                                                        data: [
                                                            { id: "A tiempo", value: analyticsData.onTimeCount, color: "#22c55e" },
                                                            { id: "Con retraso", value: analyticsData.lateCount, color: "#ef4444" },
                                                            { id: "Pendientes", value: analyticsData.pendingReceiptCount, color: "#f59e0b" },
                                                        ],
                                                        innerRadius: 0.6,
                                                        compact: true,
                                                        enableLabels: true,
                                                        arcLabel: (d: { id: string; value: number }) => {
                                                            const total = analyticsData.onTimeCount + analyticsData.lateCount + analyticsData.pendingReceiptCount
                                                            return total > 0 ? `${Math.round((d.value / total) * 100)}%` : d.id
                                                        },
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-almacen",
                                weight: 1,
                                sections: [
                                    {
                                        id: "warehouse-bar",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Órdenes por Almacén",
                                                variant: "chart",
                                                chart: {
                                                        type: "bar-chart",
                                                        data: analyticsData.ordersByWarehouse,
                                                        keys: ["count"],
                                                        indexBy: "warehouse",
                                                        axisBottomLegend: "Almacén",
                                                        axisLeftLegend: "Cantidad",
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },


                ],
            },
        }
    }, [analyticsData, viewMode])

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCheckoutOpen(true)
        }
    }, [externalOpenCheckout])

    const filteredOrders = orders
    const filteredNotes = notes

    const noteColumns: ColumnDef<Invoice>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <DataCell.Text>{row.original.dte_type_display || '-'}</DataCell.Text>
            ),
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
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
            accessorKey: "partner_name",
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
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
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
    ]

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteOrder(id)
        } catch (error: unknown) {
            console.error("Error deleting order:", error)
            showApiError(error, "Error al eliminar la orden de compra.")
        }
    })

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

    const forceAnnulColumns: ColumnDef<Order>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <DataCell.Text>{row.original.dte_type_display || '-'}</DataCell.Text>
            ),
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
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
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
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
        <div className="h-full flex flex-col">
            {editingOrder && (
                <PurchaseOrderModal
                    initialData={editingOrder as unknown as any}
                    open={!!editingOrder}
                    onOpenChange={(open) => {
                        if (!open) setEditingOrder(null)
                    }}
                    onSuccess={fetchOrders}
                />
            )}

            <Tabs value={viewMode} className="w-full h-full flex flex-col">
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel={viewMode === 'orders' ? 'purchasing.purchaseorder' : 'billing.invoice'}
                        columns={(viewMode === 'orders' ? columns : noteColumns) as any}
                        data={(viewMode === 'orders' ? filteredOrders : filteredNotes) as any}
                        onRowClick={(row: any) => toggleSelection(row.id)}
                        variant="embedded"
                        isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                        isRefetching={viewMode === 'orders' ? isRefetching : undefined}
                        smartSearch={<SmartSearchBar searchDef={purchaseOrderSearchDef} placeholder="Buscar por proveedor..." className="w-full" />}
                        segmentation={<SegmentationBar def={purchaseOrderSegDef} basePeriod={basePeriod} />}
                        showReset={isFiltered}
                        onReset={() => { clearText(); clearSeg() }}
                        sortOptions={true}
                        createAction={createAction}
                        isSelected={(data: any) => viewMode === 'orders'
                            ? hubConfig?.orderId === data.id
                            : hubConfig?.invoiceId === data.id
                        }
                        isHubOpen={isHubOpen}
                        isFiltered={isFiltered}
                        analyticsPanel={viewMode === 'orders' ? analyticsPanel : undefined}
                        emptyState={{
                            context: "purchase",
                            title: viewMode === 'orders' ? "Aún no hay órdenes de compra" : "Aún no hay notas de compra",
                            description: viewMode === 'orders'
                                ? "Crea una orden de compra para registrar tus adquisiciones a proveedores."
                                : "Las notas asociadas a tus documentos de compra aparecerán aquí.",
                        }}
                    />
                </div>
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
                        contactId={invoicingOrder?.supplier || ((orders as unknown as PurchaseOrder[]).find((o) => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === completingInvoice.id))?.supplier ?? undefined)}
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
                orderLines={[{ product: "", product_name: "", quantity: 1, uom: "", uom_name: "", unit_cost: 0, tax_rate: rate } as any]}
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
                        contactId={invoicingOrder?.supplier || ((orders as unknown as PurchaseOrder[]).find((o) => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === selectedInvoice.id))?.supplier ?? undefined)}
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
