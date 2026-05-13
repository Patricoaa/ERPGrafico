"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef, Row } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, List, ArrowRight, ArrowLeft } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { EntityCard } from "@/components/shared/EntityCard"

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
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { salesOrderSearchDef } from "@/features/sales/searchDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { cn } from "@/lib/utils"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"


interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
}

export function SalesOrdersView({ viewMode, posSessionId, onActionSuccess, hideStatusInCards }: SalesOrdersViewProps) {
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const [currentView, setCurrentView] = React.useState<'card' | 'list'>(
        (searchParams.get('view') as 'card' | 'list') ?? 'card'
    )

    const handleViewChange = (v: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', v)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        setCurrentView(v as 'card' | 'list')
    }

    useEffect(() => {
        const viewParam = searchParams.get('view')
        if (!viewParam) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('view', 'card')
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            setCurrentView('card')
        } else if (viewParam !== currentView) {
            setCurrentView(viewParam as 'card' | 'list')
        }
    }, [searchParams, pathname, router, currentView])

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

    const viewOptions = [
        { label: "Lista", value: "list", icon: List },
        { label: "Tarjeta", value: "card", icon: LayoutDashboard }

    ]

    const { filters: smartFilters } = useSmartSearch(salesOrderSearchDef)
    const { orders, isLoading: isLoadingOrders, refetch: refetchOrders } = useSalesOrders({
        filters: {
            ...(smartFilters as SaleOrderFilters),
            pos_session: posSessionId || undefined,
        }
    })
    const { data: notes, isLoading: isLoadingNotes, refetch: refetchNotes } = useSalesNotes()

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
            cell: ({ row }) => <DataCell.DocumentId label="sales.saleorder" data={row.original} />,
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
                            onClick={() => toggleSelection(item.id)}
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
            cell: ({ row }) => <DataCell.DocumentId label="billing.invoice" data={row.original} />,
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
                            onClick={() => toggleSelection(item.id)}
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
                data={(viewMode === 'orders' ? orders : filteredNotes) as any}
                onRowClick={(row: any) => toggleSelection(row.original.id)}
                variant="embedded"
                isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                    currentView={currentView}
                    onViewChange={handleViewChange}
                    viewOptions={viewOptions}
                    // orders: SmartSearchBar server-side + badge facets client-side
                    // notes: input client-side + status facets + date range
                    leftAction={viewMode === 'orders'
                        ? <SmartSearchBar searchDef={salesOrderSearchDef} placeholder="Buscar órdenes..." className="w-80" />
                        : undefined
                    }
                    filterColumn={viewMode === 'notes' ? "number" : undefined}
                    searchPlaceholder={viewMode === 'notes' ? "Buscar por número..." : undefined}
                    facetedFilters={viewMode === 'orders' ? [
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
                    ] : [
                        {
                            column: "status",
                            title: "Estado",
                            options: [
                                { label: "Borrador", value: "DRAFT" },
                                { label: "Publicado", value: "POSTED" },
                                { label: "Pagado", value: "PAID" },
                                { label: "Anulado", value: "CANCELLED" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={viewMode === 'notes'}
                    showToolbarSort={true}
                    onReset={viewMode === 'notes' ? () => setDateRange(undefined) : undefined}
                    customFilters={viewMode === 'notes'
                        ? <DateRangeFilter
                            onDateChange={setDateRange}
                            label="Fecha de Emisión"
                            className="bg-transparent border-none w-full"
                          />
                        : undefined
                    }
                    isCustomFiltered={viewMode === 'notes' ? !!dateRange : undefined}
                    customFilterCount={dateRange ? 1 : 0}

                    defaultPageSize={20}
                    renderCustomView={currentView === 'card' ? (table) => {
                        const rows = table.getRowModel().rows
                        if (rows.length === 0) {
                            return (
                                <EmptyState
                                    context="search"
                                    title={viewMode === 'orders' ? `No se encontraron ${ENTITY_REGISTRY['sales.saleorder']?.titlePlural.toLowerCase()}` : "No se encontraron notas"}
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
                                            onClick={() => toggleSelection(id)}
                                        />
                                    )
                                })}
                            </div>
                        )
                    } : undefined}
                    renderLoadingView={currentView === 'card' ? () => (
                        <div className="grid gap-3 pt-1">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <EntityCard.Skeleton key={i} />
                            ))}
                        </div>
                    ) : undefined}
                />
            
        </Tabs>
    )
}
