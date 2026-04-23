"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef, Row } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, List, ArrowRight, ArrowLeft } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay, format } from "date-fns"
import { OrderHubStatus } from "@/features/orders/components/OrderHubStatus"
import { getHubStatuses } from '@/features/orders/utils/status'
import { OrderCard } from "@/features/orders/components/OrderCard"
import { DataCell } from "@/components/ui/data-table-cells"
import { NoteHubStatus } from "@/features/orders/components/NoteHubStatus"
import { Tabs } from "@/components/ui/tabs"
import { useSalesOrders, useSalesNotes, type SaleOrder, type SaleNote } from "@/features/sales"
import { cn } from "@/lib/utils"


interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
}

export function SalesOrdersView({ viewMode, posSessionId, onActionSuccess, hideStatusInCards }: SalesOrdersViewProps) {
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    const [currentView, setCurrentView] = useState<'card' | 'list'>('card')

    const viewOptions = [
        { label: "Lista", value: "list", icon: List },
        { label: "Tarjeta", value: "card", icon: LayoutDashboard }

    ]

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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => <DataCell.DocumentId type="SALE_ORDER" number={row.getValue("number")} />,
            meta: { title: "Folio" },
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
            meta: { title: "Fecha" },
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => <DataCell.ContactLink contactId={row.original.customer}>{row.getValue("customer_name")}</DataCell.ContactLink>,
            meta: { title: "Cliente" },
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" className="justify-center" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
            meta: { title: "Total" },
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estados" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center items-center"><OrderHubStatus order={row.original as any} /></div>,
            meta: { title: "Estado" },
        },
        // Hidden filter columns
        {
            id: "production_status",
            accessorFn: (row) => getHubStatuses(row as any).production,
            header: () => null,
            cell: () => null,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
            enableHiding: false,
        },
        {
            id: "logistics_status",
            accessorFn: (row) => getHubStatuses(row as any).logistics,
            header: () => null,
            cell: () => null,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
            enableHiding: false,
        },
        {
            id: "billing_status",
            accessorFn: (row) => getHubStatuses(row as any).billing,
            header: () => null,
            cell: () => null,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
            enableHiding: false,
        },
        {
            id: "treasury_status",
            accessorFn: (row) => getHubStatuses(row as any).treasury,
            header: () => null,
            cell: () => null,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
            enableHiding: false,
        },
        {
            id: "hub_trigger",
            header: () => null,
            enableHiding: false,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.orderId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <DataCell.Action
                            icon={isSelected && isHubOpen ? ArrowLeft : ArrowRight}
                            title={isSelected && isHubOpen ? "Cerrar Panel" : "Abrir Panel"}
                            className={cn(
                                "transition-all",
                                isSelected && isHubOpen 
                                    ? "text-primary animate-in fade-in slide-in-from-right-1 duration-300" 
                                    : "text-muted-foreground/30 hover:text-primary hover:translate-x-0.5"
                            )}
                            onClick={() => {
                                if (isSelected) {
                                    closeHub()
                                } else {
                                    openHub({ orderId: item.id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                                }
                            }}
                        />
                    </div>
                )
            },
        }
    ]

    const noteColumns: ColumnDef<SaleNote>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Documento" className="justify-center" />,
            cell: ({ row }) => <DataCell.Secondary className="font-bold uppercase text-[10px] text-center">{row.original.dte_type_display}</DataCell.Secondary>,
            meta: { title: "Documento" },
        },
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" className="justify-center" />,
            cell: ({ row }) => <DataCell.DocumentId type={row.original.dte_type} number={row.getValue("number")} />,
            meta: { title: "Número" },
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => <DataCell.ContactLink contactId={(row.original as any).customer || row.original.partner}>{(row.original as any).customer_name || row.original.partner_name}</DataCell.ContactLink>,
            meta: { title: "Cliente" },
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" className="justify-center" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
            meta: { title: "Total" },
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estados" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center items-center">
                    <NoteHubStatus note={row.original as any} />
                </div>
            ),
        },
        {
            id: "hub_trigger",
            header: () => null,
            enableHiding: false,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.invoiceId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <DataCell.Action
                            icon={isSelected && isHubOpen ? ArrowLeft : ArrowRight}
                            title={isSelected && isHubOpen ? "Cerrar Panel" : "Abrir Panel"}
                            className={cn(
                                "transition-all",
                                isSelected && isHubOpen 
                                    ? "text-primary animate-in fade-in slide-in-from-right-1 duration-300" 
                                    : "text-muted-foreground/30 hover:text-primary hover:translate-x-0.5"
                            )}
                            onClick={() => {
                                if (isSelected) {
                                    closeHub()
                                } else {
                                    openHub({ orderId: null, invoiceId: item.id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                                }
                            }}
                        />
                    </div>
                )
            },
        }
    ]

    return (
        <Tabs value={viewMode} className="w-full flex flex-col h-full">
            <DataTable
                columns={(viewMode === 'orders' ? columns : noteColumns) as any}
                data={(viewMode === 'orders' ? filteredOrders : filteredNotes) as any}
                onRowClick={(row: any) => {
                    const id = row.original.id
                    const isSelected = viewMode === "orders" ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
                    if (isSelected && isHubOpen) {
                        closeHub()
                    } else {
                        if (viewMode === "orders") {
                            openHub({ orderId: id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                        } else {
                            openHub({ orderId: null, invoiceId: id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                        }
                    }
                }}
                cardMode={true}
                    currentView={currentView}
                    onViewChange={(v) => setCurrentView(v as 'list' | 'card')}
                    viewOptions={viewOptions}
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
                    customFilters={
                        <DateRangeFilter
                            onRangeChange={setDateRange}
                            label={viewMode === 'orders' ? "Fecha de Venta" : "Fecha de Emisión"}
                            className="bg-transparent border-none w-full"
                        />
                    }
                    isCustomFiltered={!!dateRange}
                    customFilterCount={dateRange ? 1 : 0}

                    defaultPageSize={20}
                    renderCustomView={currentView === 'card' ? (table) => {
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
                                {rows.map((row) => {
                                    const item = row.original as any
                                    const id = Number(item.id)
                                    const isSelected = viewMode === 'orders'
                                        ? hubConfig?.orderId === id
                                        : hubConfig?.invoiceId === id

                                    return (
                                        <OrderCard
                                            key={id}
                                            item={item}
                                            isSelected={isSelected}
                                            isHubOpen={isHubOpen}
                                            type={viewMode === 'orders' ? 'sale' : 'note'}
                                            hideStatus={hideStatusInCards}
                                            visibleColumns={table.getState().columnVisibility}
                                            onClick={() => {
                                                if (isSelected) {
                                                    closeHub()
                                                } else if (viewMode === 'orders') {
                                                    openHub({ orderId: id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                                                } else {
                                                    openHub({ orderId: null, invoiceId: id, type: 'sale', posSessionId, onActionSuccess: handleActionSuccess })
                                                }
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        )
                    } : undefined}
                />
            
        </Tabs>
    )
}
