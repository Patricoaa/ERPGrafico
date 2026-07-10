"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DataTableView, DataCell, DomainHubStatus, UnifiedSearchBar, useUnifiedSearch, DataTableColumnHeader, createDateColumn, createContactColumn, createCurrencyColumn, createCodeColumn } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowRight, ArrowLeft } from "lucide-react"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useSalesOrders, useSalesNotes, type SaleOrder, type SaleNote } from "@/features/sales"
import { salesOrderUnifiedSearchDef, salesNoteUnifiedSearchDef } from "@/features/sales/unifiedSearchDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { cn } from "@/lib/utils"

interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
    onSelectOrder?: (id: number | null) => void
    selectedId?: number | null
}

export function SalesOrdersView({ viewMode, posSessionId, onSelectOrder, selectedId }: SalesOrdersViewProps) {
    const { hubConfig, isHubOpen } = useHubPanel()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const toggleSelection = (id: number) => {
        if (onSelectOrder) {
            const isSelected = selectedId === id
            onSelectOrder(isSelected ? null : id)
            return
        }
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

    const unifiedSearchDef = viewMode === 'orders' ? salesOrderUnifiedSearchDef : salesNoteUnifiedSearchDef
    const search = useUnifiedSearch(unifiedSearchDef)
    const isFiltered = search.isFiltered

    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 20 })
    const [pageStateNotes, setPageStateNotes] = useState({ pageIndex: 0, pageSize: 20 })

    const { page, orders, isLoading: isLoadingOrders, isRefetching } = useSalesOrders({
        filters: {
            ...(search.filters as SaleOrderFilters),
            pos_session: posSessionId || undefined,
            page: pageState.pageIndex + 1,
            page_size: pageState.pageSize,
        },
    })
    const { page: pageNotes, notes, isLoading: isLoadingNotes, isRefetching: isRefetchingNotes } = useSalesNotes({
        filters: {
            ...(search.filters as Record<string, string>),
            page: pageStateNotes.pageIndex + 1,
            page_size: pageStateNotes.pageSize,
        }
    })

    const columns: ColumnDef<SaleOrder>[] = [
        createCodeColumn<SaleOrder>("number", "Folio", {
            render: (entity) => <DataCell.Code>{entity.display_id ?? entity.number}</DataCell.Code>,
        }),
        createDateColumn<SaleOrder>("date", "Fecha"),
        createContactColumn<SaleOrder>("customer_name", "Cliente", "customer"),
        createCurrencyColumn<SaleOrder>("total", "Total"),
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estados" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center items-center"><DomainHubStatus label="sales.saleorder" data={row.original} /></div>,
            meta: { title: "Estado" },
        },
        {
            id: "hub_trigger",
            header: () => null,
            enableHiding: false,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = onSelectOrder ? selectedId === item.id : (hubConfig?.orderId === item.id && isHubOpen)
                return (
                    <div className="flex justify-end pr-2">
                        <DataCell.Action
                            icon={isSelected ? ArrowLeft : ArrowRight}
                            title={isSelected ? "Cerrar Panel" : "Abrir Panel"}
                            className={cn(
                                "transition-all",
                                isSelected
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
            cell: ({ row }) => <DataCell.Text className="font-normal uppercase text-[11px]">{row.original.dte_type_display}</DataCell.Text>,
            meta: { title: "Documento" },
        },
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
            meta: { title: "Número" },
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => <DataCell.ContactLink contactId={(row.original as unknown as Record<string, unknown>).customer as number || row.original.partner}>{(row.original as unknown as Record<string, unknown>).customer_name as string || row.original.partner_name}</DataCell.ContactLink>,
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
                    <DomainHubStatus label="billing.invoice" data={row.original} />
                </div>
            ),
        },
        {
            id: "hub_trigger",
            header: () => null,
            enableHiding: false,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = onSelectOrder ? selectedId === item.id : (hubConfig?.invoiceId === item.id && isHubOpen)
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

    // Determine entity label based on tab
    const entityLabel = viewMode === 'orders' ? 'sales.saleorder' : 'billing.invoice'

    const getSelectionId = (item: SaleOrder | SaleNote) => {
        const id = Number(item.id)
        if (onSelectOrder) return selectedId === id
        return viewMode === 'orders' ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel={entityLabel}
                    columns={(viewMode === 'orders' ? columns : noteColumns) as unknown as ColumnDef<SaleOrder | SaleNote, unknown>[]}
                    data={(viewMode === 'orders' ? orders : notes) as unknown as (SaleOrder | SaleNote)[]}
                    onRowClick={(row: SaleOrder | SaleNote) => toggleSelection(row.id)}
                    variant="embedded"
                    isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                    isRefetching={viewMode === 'orders' ? isRefetching : isRefetchingNotes}
                    manualPagination
                    pageCount={viewMode === 'orders'
                        ? (page ? Math.ceil(page.count / page.pageSize) : 0)
                        : (pageNotes ? Math.ceil(pageNotes.count / pageNotes.pageSize) : 0)
                    }
                    rowCount={viewMode === 'orders' ? (page?.count ?? 0) : (pageNotes?.count ?? 0)}
                    pagination={viewMode === 'orders' ? pageState : pageStateNotes}
                    onPaginationChange={(viewMode === 'orders' ? setPageState : setPageStateNotes) as unknown as React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>}
                    unifiedSearch={<UnifiedSearchBar
                        config={unifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder={viewMode === 'orders' ? 'Buscar órdenes...' : 'Buscar notas...'}
                    />}
                    unifiedSearchConfig={unifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    isSelected={(data: SaleOrder | SaleNote) => !!getSelectionId(data)}
                    isHubOpen={onSelectOrder ? !!selectedId : isHubOpen}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: viewMode === 'orders' ? "sale" : "finance",
                        title: viewMode === 'orders' ? "Aún no hay órdenes de venta" : "Aún no hay notas",
                        description: viewMode === 'orders'
                            ? "Crea una orden de venta o regístrala desde el punto de venta."
                            : "Las notas de crédito y débito asociadas a tus ventas aparecerán aquí.",
                    }}
                />
            </div>
        </div>
    )
}
