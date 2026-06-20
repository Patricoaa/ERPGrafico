"use client"

import React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRight, ArrowLeft } from "lucide-react"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DomainHubStatus } from "@/components/shared"
import { DataCell } from '@/components/shared'
import { useSalesOrders, useSalesNotes, type SaleOrder, type SaleNote } from "@/features/sales"
import { SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { salesOrderSearchDef, salesNoteSearchDef } from "@/features/sales/searchDef"
import { salesOrderSegDef, salesNoteSegDef } from "@/features/sales/segmentationDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { cn } from "@/lib/utils"

interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
    onSelectOrder?: (id: number | null) => void
    selectedId?: number | null
    initialOrders?: SaleOrder[]
}

export function SalesOrdersView({ viewMode, posSessionId, onActionSuccess, hideStatusInCards, onSelectOrder, selectedId, initialOrders }: SalesOrdersViewProps) {
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
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

    const searchDef = viewMode === 'orders' ? salesOrderSearchDef : salesNoteSearchDef
    const segDef = viewMode === 'orders' ? salesOrderSegDef : salesNoteSegDef
    const basePeriod = { serverParamFrom: 'date_after', serverParamTo: 'date_before' }
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(searchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(segDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered

    const { orders, isLoading: isLoadingOrders, isRefetching, refetch: refetchOrders } = useSalesOrders({
        filters: {
            ...(textFilters as SaleOrderFilters),
            ...(segFilters as Record<string, string>),
            pos_session: posSessionId || undefined,
        },
        initialData: initialOrders,
    })
    const { notes, isLoading: isLoadingNotes, refetch: refetchNotes } = useSalesNotes({
        filters: {
            ...(textFilters as Record<string, string>),
            ...(segFilters as Record<string, string>),
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
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
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

    const getSelectionId = (item: any) => {
        const id = Number(item.id)
        if (onSelectOrder) return selectedId === id
        return viewMode === 'orders' ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel={entityLabel}
                    columns={(viewMode === 'orders' ? columns : noteColumns) as any}
                    data={(viewMode === 'orders' ? orders : filteredNotes) as any}
                    onRowClick={(row: any) => toggleSelection(row.id)}
                    variant="embedded"
                    isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                    isRefetching={viewMode === 'orders' ? isRefetching : undefined}
                    smartSearch={viewMode === 'orders'
                        ? <SmartSearchBar searchDef={salesOrderSearchDef} placeholder="Buscar órdenes..." />
                        : <SmartSearchBar searchDef={salesNoteSearchDef} placeholder="Buscar notas..." />
                    }
                    segmentation={viewMode === 'orders'
                        ? <SegmentationBar def={salesOrderSegDef} basePeriod={basePeriod} />
                        : <SegmentationBar def={salesNoteSegDef} basePeriod={basePeriod} />
                    }
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={20}
                    isSelected={(data: any) => !!getSelectionId(data)}
                    isHubOpen={onSelectOrder ? !!selectedId : isHubOpen}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: viewMode === 'orders' ? "sale" : "finance",
                        title: viewMode === 'orders' ? "Aún no hay órdenes de venta" : "Aún no hay notas",
                        description: viewMode === 'orders'
                            ? "Crea una orden de venta o regístrala desde el punto de venta."
                            : "Las notas de crédito y débito asociadas a tus ventas aparecerán aquí.",
                    }}
                    cardGroupBy={{ dateField: 'date', amountField: 'total' }}
                />
            </div>
        </div>
    )
}
