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
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay, format } from "date-fns"
import { OrderHubStatus } from "@/components/orders/OrderHubStatus"
import { getHubStatuses } from "@/lib/order-status-utils"
import { OrderCard } from "@/components/orders/OrderCard"
import { DataCell } from "@/components/ui/data-table-cells"
import { translateSalesChannel, formatPlainDate } from "@/lib/utils"
import { NoteHubStatus } from "@/components/orders/NoteHubStatus"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSalesOrders, useSalesNotes, type SaleOrder } from "@/features/sales"



interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
}

export function SalesOrdersView({ viewMode, posSessionId, onActionSuccess, hideStatusInCards }: SalesOrdersViewProps) {
    const { openCommandCenter } = useGlobalModals()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

    const { orders } = useSalesOrders({
        filters: {
            pos_session: posSessionId || undefined
        }
    })
    const { data: notes, isLoading: loadingNotes } = useSalesNotes()

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
            cell: ({ row }) => <NoteHubStatus note={row.original} />,
            meta: { title: "Estado" },
        },
        {
            id: "status",
            accessorFn: (row) => row.status,
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        }
    ]

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {loadingNotes ? (
                <div className="flex items-center justify-center flex-1 py-12">
                    <div className="text-muted-foreground">Cargando datos...</div>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <Tabs value={viewMode} className="w-full h-full flex flex-col">
                        <DataTable
                            columns={viewMode === 'orders' ? columns : noteColumns}
                            data={viewMode === 'orders' ? filteredOrders : filteredNotes}
                            cardMode
                            filterColumn={viewMode === 'orders' ? "customer_name" : "number"}
                            searchPlaceholder={viewMode === 'orders' ? "Buscar por cliente..." : "Buscar por número..."}
                            facetedFilters={[
                                {
                                    column: "status",
                                    title: "Origen",
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
                                                    type={viewMode === 'orders' ? 'sale' : 'note'}
                                                    hideStatus={hideStatusInCards}
                                                    onClick={() => {
                                                        if (viewMode === 'orders') {
                                                            openCommandCenter(item.id, 'sale', null, posSessionId, onActionSuccess)
                                                        } else {
                                                            openCommandCenter(null, 'sale', item.id, posSessionId, onActionSuccess)
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
                </div>
            )}
        </div>
    )
}
