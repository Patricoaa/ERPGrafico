"use client"

import React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRight, ArrowLeft } from "lucide-react"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DomainHubStatus } from "@/components/shared"
import { DataCell } from "@/components/ui/data-table-cells"
import { Tabs } from "@/components/ui/tabs"
import { useSalesOrders, useSalesNotes, type SaleOrder, type SaleNote } from "@/features/sales"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { salesOrderSearchDef, salesNoteSearchDef } from "@/features/sales/searchDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { cn } from "@/lib/utils"
import { useViewMode } from "@/hooks/useViewMode"
import { createDomainCardView, createCardLoadingView } from "@/lib/view-helpers"


interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
}

export function SalesOrdersView({ viewMode, posSessionId, onActionSuccess, hideStatusInCards }: SalesOrdersViewProps) {
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode('sales.saleorder')

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

    const { filters: smartFilters } = useSmartSearch(salesOrderSearchDef)
    const { orders, isLoading: isLoadingOrders, refetch: refetchOrders } = useSalesOrders({
        filters: {
            ...(smartFilters as SaleOrderFilters),
            pos_session: posSessionId || undefined,
        }
    })
    const { data: notes, isLoading: isLoadingNotes, refetch: refetchNotes } = useSalesNotes({
        filters: {
            customer_name: (smartFilters as Record<string, string>).customer_name,
            date_after: (smartFilters as Record<string, string>).date_after,
            date_before: (smartFilters as Record<string, string>).date_before,
        }
    })

    const handleActionSuccess = () => {
        // Refetch both to ensure cards background update
        refetchOrders()
        refetchNotes()
        // Call the parent success (e.g. closing modal or custom logic)
        if (onActionSuccess) onActionSuccess()
    }

    const filteredNotes = (notes || []).filter(note =>
        ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(note.dte_type) && !!note.sale_order
    )

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
            cell: ({ row }) => <div className="flex justify-center items-center"><DomainHubStatus label="sales.saleorder" data={row.original} /></div>,
            meta: { title: "Estado" },
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

    // Determine entity label based on tab
    const entityLabel = viewMode === 'orders' ? 'sales.saleorder' : 'billing.invoice'

    const getSelectionId = (item: any) => {
        const id = Number(item.id)
        return viewMode === 'orders' ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
    }

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
                leftAction={viewMode === 'orders'
                    ? <SmartSearchBar searchDef={salesOrderSearchDef} placeholder="Buscar órdenes..." />
                    : <SmartSearchBar searchDef={salesNoteSearchDef} placeholder="Buscar notas..." />
                }
                showToolbarSort={true}

                defaultPageSize={20}
                renderCustomView={isCustomView ? createDomainCardView(entityLabel, {
                    onRowClick: (data) => toggleSelection(data.id),
                    isSelected: (data) => !!getSelectionId(data),
                    isHubOpen,
                }) : undefined}
                renderLoadingView={isCustomView ? createCardLoadingView('single-column') : undefined}
            />

        </Tabs>
    )
}
