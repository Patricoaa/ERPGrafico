"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
    LayoutDashboard, Monitor, ArrowRight, Calendar,
    ShoppingCart, Package, FileBadge
} from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay, format } from "date-fns"
import { OrderHubStatus } from "@/features/orders/components/OrderHubStatus"
import { getHubStatuses } from "@/lib/order-status-utils"
import { OrderCard } from "@/features/orders/components/OrderCard"
import { DataCell } from "@/components/ui/data-table-cells"
import { translateSalesChannel, formatPlainDate } from "@/lib/utils"
import { NoteHubStatus } from "@/features/orders/components/NoteHubStatus"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSalesOrders, useSalesNotes, type SaleOrder } from "@/features/sales"
import { HubDockLayout } from "@/components/shared/HubDockLayout"



interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
}

export function SalesOrdersView({ viewMode, posSessionId, onActionSuccess, hideStatusInCards }: SalesOrdersViewProps) {
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

    const { orders, refetch: refetchOrders } = useSalesOrders({
        filters: {
            pos_session: posSessionId || undefined
        }
    })
    const { data: notes, isLoading: loadingNotes, refetch: refetchNotes } = useSalesNotes()

    const handleActionSuccess = () => {
        // Refetch both to ensure cards background update
        refetchOrders()
        refetchNotes()
        // Call the parent success (e.g. closing modal or custom logic)
        if (onActionSuccess) onActionSuccess()
    }

    const filteredOrders = orders.filter(order => {
        if (!dateRange || !dateRange.from) return true
        const orderDate = parseISO(order.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(orderDate, { start, end })
    })

    const filteredNotes = (notes || []).filter(note => {
        // Only show Credit and Debit notes
        if (!['NOTA_CREDITO', 'NOTA_DEBITO'].includes(note.dte_type)) return false
        // Only show documents linked to a Sale Order (Emitted)
        if (!note.sale_order) return false
        
        if (!dateRange || !dateRange.from) return true
        const noteDate = parseISO(note.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(noteDate, { start, end })
    })

    const columns: ColumnDef<SaleOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
            cell: ({ row }) => <DataCell.DocumentId type="SALE_ORDER" number={row.getValue("number")} />,
            meta: { title: "Folio" },
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
            meta: { title: "Fecha" },
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("customer_name")}</DataCell.Text>,
            meta: { title: "Cliente" },
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
            meta: { title: "Total" },
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado Hub" />,
            cell: ({ row }) => <OrderHubStatus order={row.original} />,
            meta: { title: "Estado" },
        },
        // Hidden filter columns
        {
            id: "production_status",
            accessorFn: (row) => getHubStatuses(row).production,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "logistics_status",
            accessorFn: (row) => getHubStatuses(row).logistics,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "billing_status",
            accessorFn: (row) => getHubStatuses(row).billing,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "treasury_status",
            accessorFn: (row) => getHubStatuses(row).treasury,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        }
    ]

    const noteColumns: ColumnDef<any>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Documento" />,
            cell: ({ row }) => <span className="text-xs">{row.original.dte_type_display}</span>,
            meta: { title: "Documento" },
        },
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
            cell: ({ row }) => <DataCell.DocumentId type={row.original.dte_type} number={row.getValue("number")} />,
            meta: { title: "Número" },
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
            cell: ({ row }) => <DataCell.Text>{row.original.customer_name || row.original.partner_name}</DataCell.Text>,
            meta: { title: "Cliente" },
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
            meta: { title: "Total" },
        },
        {
            id: "status_hub",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado Hub" />,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <NoteHubStatus note={row.original} />
                </div>
            ),
            meta: { title: "Estado" },
        },
        {
            id: "status",
            accessorFn: (row) => row.status,
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        }
    ]

    return (
        <Tabs value={viewMode} className="w-full flex flex-col h-full">
            <HubDockLayout>
                <DataTable
                    columns={viewMode === 'orders' ? columns : noteColumns}
                    data={viewMode === 'orders' ? filteredOrders : filteredNotes}
                    cardMode
                    isLoading={viewMode === 'notes' ? loadingNotes : false}
                    filterColumn={viewMode === 'orders' ? "customer_name" : "number"}
                    searchPlaceholder={viewMode === 'orders' ? "Buscar por cliente..." : "Buscar por número..."}
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: viewMode === 'orders' ? [
                                { label: "Borrador", value: "DRAFT" },
                                { label: "Confirmado", value: "CONFIRMED" },
                                { label: "Facturado", value: "INVOICED" },
                                { label: "Pagado", value: "PAID" },
                                { label: "Anulado", value: "CANCELLED" },
                            ] : [
                                { label: "Borrador", value: "DRAFT" },
                                { label: "Publicado", value: "POSTED" },
                                { label: "Pagado", value: "PAID" },
                                { label: "Anulado", value: "CANCELLED" },
                            ],
                        },
                        ...(viewMode === 'orders' ? [
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
                        ] : [])
                    ]}
                    useAdvancedFilter={true}
                    showToolbarSort={true}
                    onReset={() => setDateRange(undefined)}
                    toolbarAction={
                        <div className="flex items-center gap-2">
                            <DateRangeFilter onRangeChange={setDateRange} label={viewMode === 'orders' ? "Fecha de Venta" : "Fecha de Emisión"} />
                        </div>
                    }

                    defaultPageSize={20}
                    renderCustomView={(table) => {
                        const rows = table.getRowModel().rows
                        if (rows.length === 0) {
                            return (
                                <EmptyState
                                    context="search"
                                    title={viewMode === 'orders' ? "No se encontraron órdenes" : "No se encontraron notas"}
                                    description="Ajusta el rango de fechas o los filtros para encontrar lo que buscas."
                                />
                            )
                        }
                        return (
                            <div className="grid gap-3 pt-1">
                                {rows.map((row: any) => {
                                    const item = row.original
                                    const isSelected = viewMode === 'orders' 
                                        ? hubConfig?.orderId === item.id 
                                        : hubConfig?.invoiceId === item.id
                                        
                                    return (
                                        <OrderCard
                                            key={item.id}
                                            item={item}
                                            isSelected={isSelected}
                                            isHubOpen={isHubOpen}
                                            type={viewMode === 'orders' ? 'sale' : 'note'}
                                            hideStatus={hideStatusInCards}
                                            onClick={() => {
                                                if (isSelected) {
                                                    closeHub()
                                                } else if (viewMode === 'orders') {
                                                    openHub({ orderId: item.id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                                                } else {
                                                    openHub({ orderId: null, invoiceId: item.id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                                                }
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        )
                    }}
                />
            </HubDockLayout>
        </Tabs>
    )
}
