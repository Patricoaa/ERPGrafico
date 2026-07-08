"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Chip, DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, EntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"

import { useSaleDeliveries } from "../hooks/useSaleDeliveries"
import React from "react"

const DELIVERY_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral", label: string }> = {
    'normal': { intent: 'success', label: 'Normal' },
    'debit_note': { intent: 'warning', label: 'Nota Débito' },
}

const deliverySearchDef = {
    fields: [
        { key: 'search', label: 'Buscar por DES#, cliente, OV...', type: 'text' as const, serverParam: 'search' as const },
    ],
}

const deliverySegDef = {
    segments: [
        {
            key: 'status' as const,
            label: 'Estado',
            type: 'tabs' as const,
            serverParam: 'status' as const,
            options: [
                { value: '', label: 'Todos' },
                { value: 'DRAFT', label: 'Borrador' },
                { value: 'CONFIRMED', label: 'Confirmados' },
                { value: 'CANCELLED', label: 'Anulados' },
            ],
        },
        {
            key: 'type' as const,
            label: 'Tipo',
            type: 'tabs' as const,
            serverParam: 'note_type' as const,
            options: [
                { value: '', label: 'Todos' },
                { value: 'normal', label: 'Normal' },
                { value: 'debit_note', label: 'Nota Débito' },
            ],
        },
    ],
}

export function SaleDeliveryClientView() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(deliverySearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(deliverySegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = useMemo(() => ({ ...textFilters, ...segFilters }), [textFilters, segFilters])
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })

    const { page, deliveries, totalCount, isLoading } = useSaleDeliveries({
        ...allFilters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const [viewingTransaction, setViewingTransaction] = useState<{ type: TransactionType, id: number | string } | null>(null)

    useEffect(() => {
        const selectedId = searchParams.get('selected')
        if (selectedId && !viewingTransaction) {
            requestAnimationFrame(() => {
                setViewingTransaction({ type: 'sale_delivery', id: selectedId })
            })
        }
    }, [searchParams, viewingTransaction])

    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => [
        {
            id: "folio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <DataCell.Code>{String(row.original.display_id ?? `DES-${row.original.number}`)}</DataCell.Code>
                    <DataCell.Date value={String(row.original.delivery_date)} />
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1 w-full">
                    <DataCell.Text>{String(row.original.customer_name ?? '')}</DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "sale_order_number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="O. Venta" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text>{String(row.original.sale_order_number ?? '')}</DataCell.Text>
            ),
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bodega" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text>{String(row.original.warehouse_name ?? '')}</DataCell.Text>,
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => {
                const status = String(row.original.status ?? '')
                return (
                    <div className="flex justify-center w-full">
                        <Chip intent={status === 'CONFIRMED' ? 'success' : status === 'CANCELLED' ? 'destructive' : 'neutral'} size="sm">
                            {status === 'DRAFT' ? 'Borrador' : status === 'CONFIRMED' ? 'Confirmado' : 'Anulado'}
                        </Chip>
                    </div>
                )
            },
            size: 100,
        },
        {
            accessorKey: "delivery_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = String(row.original.delivery_type ?? 'normal')
                const config = DELIVERY_TYPE_MAP[type] || { intent: 'neutral' as const, label: type }
                return (
                    <div className="flex justify-center w-full">
                        <Chip intent={config.intent} size="sm">{config.label}</Chip>
                    </div>
                )
            },
            size: 100,
        },
    ], [])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="sales.saledelivery"
                    columns={columns}
                    data={deliveries}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination
                    pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={pageState}
                    onPaginationChange={setPageState}
                    smartSearch={<SmartSearchBar searchDef={deliverySearchDef} placeholder="Buscar despachos..." className="w-full" />}
                    segmentation={<SegmentationBar def={deliverySegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "sale",
                        title: "Aún no hay despachos",
                        description: "Los despachos se registran al confirmar una orden de venta o crear una nota de débito.",
                    }}
                    cardGroupBy={{ field: 'delivery_date', sort: 'desc', aggregators: [{ key: 'count', label: 'Items', fn: 'count', format: 'integer' }] }}
                    renderCard={(delivery: Record<string, unknown>) => {
                        const type = String(delivery.delivery_type ?? 'normal')
                        const typeConfig = DELIVERY_TYPE_MAP[type] || { intent: 'neutral' as const, label: type }
                        return (
                            <EntityCard
                                key={delivery.id as number}
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams.toString())
                                    params.set('selected', String(delivery.id))
                                    router.push(`${pathname}?${params.toString()}`, { scroll: false })
                                }}
                            >
                                <EntityCard.Header
                                    title={String(delivery.customer_name ?? '')}
                                    subtitle={String(delivery.display_id ?? `DES-${delivery.number}`)}
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field label="Fecha" value={<DataCell.Date value={String(delivery.delivery_date)} />} />
                                    <EntityCard.Field label="Bodega" value={String(delivery.warehouse_name ?? '')} />
                                    <EntityCard.Field label="Estado" value={<Chip intent={String(delivery.status) === 'CONFIRMED' ? 'success' : 'neutral'} size="sm">{String(delivery.status)}</Chip>} />
                                    <EntityCard.Field label="Tipo" value={<Chip intent={typeConfig.intent} size="sm">{typeConfig.label}</Chip>} />
                                </EntityCard.Body>
                            </EntityCard>
                        )
                    }}
                />
            </div>

            {viewingTransaction && (
                <LazyDrawer
                    type={viewingTransaction.type}
                    id={Number(viewingTransaction.id)}
                    open={!!viewingTransaction}
                    onOpenChange={(open) => {
                        if (!open) {
                            setViewingTransaction(null)
                            clearSelection()
                        }
                    }}
                />
            )}
        </div>
    )
}
