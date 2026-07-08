"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Chip, DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, EntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"

import { usePurchaseReceipts } from "../hooks/usePurchasing"
import React from "react"

const RECEIPT_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral", label: string }> = {
    'normal': { intent: 'success', label: 'Normal' },
    'debit_note': { intent: 'warning', label: 'Nota Débito' },
}

const receiptSearchDef = {
    fields: [
        { key: 'search', label: 'Buscar por REC#, proveedor, OC...', type: 'text' as const, serverParam: 'search' as const },
    ],
}

const receiptSegDef = {
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

export function PurchaseReceiptClientView() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(receiptSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(receiptSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = useMemo(() => ({ ...textFilters, ...segFilters }), [textFilters, segFilters])
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })

    const { page, receipts, totalCount, isLoading } = usePurchaseReceipts({
        ...allFilters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const [viewingTransaction, setViewingTransaction] = useState<{ type: TransactionType, id: number | string } | null>(null)

    useEffect(() => {
        const selectedId = searchParams.get('selected')
        if (selectedId && !viewingTransaction) {
            requestAnimationFrame(() => {
                setViewingTransaction({ type: 'purchase_receipt', id: selectedId })
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
                    <DataCell.Code>{String(row.original.display_id ?? `REC-${row.original.number}`)}</DataCell.Code>
                    <DataCell.Date value={String(row.original.receipt_date)} />
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1 w-full">
                    <DataCell.Text>{String(row.original.supplier_name ?? '')}</DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "purchase_order_number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="O. Compra" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text>{String(row.original.purchase_order_number ?? '')}</DataCell.Text>
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
            accessorKey: "receipt_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = String(row.original.receipt_type ?? 'normal')
                const config = RECEIPT_TYPE_MAP[type] || { intent: 'neutral' as const, label: type }
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
                    entityLabel="purchasing.purchasereceipt"
                    columns={columns}
                    data={receipts}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination
                    pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={pageState}
                    onPaginationChange={setPageState}
                    smartSearch={<SmartSearchBar searchDef={receiptSearchDef} placeholder="Buscar recepciones..." className="w-full" />}
                    segmentation={<SegmentationBar def={receiptSegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "purchase",
                        title: "Aún no hay recepciones",
                        description: "Las recepciones se registran al confirmar una orden de compra o crear una nota de débito.",
                    }}
                    cardGroupBy={{ field: 'receipt_date', sort: 'desc', aggregators: [{ key: 'count', label: 'Items', fn: 'count', format: 'integer' }] }}
                    renderCard={(receipt: Record<string, unknown>) => {
                        const type = String(receipt.receipt_type ?? 'normal')
                        const typeConfig = RECEIPT_TYPE_MAP[type] || { intent: 'neutral' as const, label: type }
                        return (
                            <EntityCard
                                key={receipt.id as number}
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams.toString())
                                    params.set('selected', String(receipt.id))
                                    router.push(`${pathname}?${params.toString()}`, { scroll: false })
                                }}
                            >
                                <EntityCard.Header
                                    title={String(receipt.supplier_name ?? '')}
                                    subtitle={String(receipt.display_id ?? `REC-${receipt.number}`)}
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field label="Fecha" value={<DataCell.Date value={String(receipt.receipt_date)} />} />
                                    <EntityCard.Field label="Bodega" value={String(receipt.warehouse_name ?? '')} />
                                    <EntityCard.Field label="Estado" value={<Chip intent={String(receipt.status) === 'CONFIRMED' ? 'success' : 'neutral'} size="sm">{String(receipt.status)}</Chip>} />
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
