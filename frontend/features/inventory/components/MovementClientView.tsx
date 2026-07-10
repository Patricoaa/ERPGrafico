"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { BaseModal, Chip, DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, EntityCard } from '@/components/shared'
import { stockMoveActions, type StockMoveActionsCtx } from "@/features/inventory/stockMoveActions"
import { type ColumnDef } from "@tanstack/react-table"

import {ArrowRightLeft} from "lucide-react"

import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { CancelButton, SubmitButton, FormFooter } from "@/components/shared"

export interface StockMove {
    id: number
    display_id?: string
    date: string
    product_name: string
    product_internal_code?: string
    product_code?: string
    source_location: number
    source_location_name: string
    destination_location: number
    destination_location_name: string
    quantity: string
    uom_name: string
    description: string
    related_documents: Array<{
        type: string
        id: number | string
        name: string
    }>
}
interface MovementClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useStockMoves } from "@/features/inventory/hooks/useStockMoves"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { stockMoveUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import React from "react"



export function MovementClientView({ externalOpen, onExternalOpenChange, createAction: externalCreateAction }: MovementClientViewProps) {
    const createAction = externalCreateAction
    const search = useUnifiedSearch(stockMoveUnifiedSearchDef)
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, moves, totalCount, isLoading, refetch } = useStockMoves({
        ...search.filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })
    const [viewingTransaction, setViewingTransaction] = useState<{ type: TransactionType, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
    const [isFormLoading, setIsFormLoading] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Open detail modal if ?selected= is present (ADR-0020)
    useEffect(() => {
        const selectedId = searchParams.get('selected')
        if (selectedId && !viewingTransaction) {
            requestAnimationFrame(() => {
                setViewingTransaction({ type: 'inventory', id: selectedId })
            })
        }
    }, [searchParams, viewingTransaction])

    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const handleCloseModal = () => {
        setShowAdjustmentModal(false)
        onExternalOpenChange?.(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const actionsCtx: StockMoveActionsCtx = {
        onViewDetails: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        {
            id: "folio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <DataCell.Code>{row.original.display_id ?? String(row.original.id)}</DataCell.Code>
                    <DataCell.Date value={row.original.date} />
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1 w-full">
                    <DataCell.Text>{row.original.product_name}</DataCell.Text>
                    <div className="flex gap-2 items-center justify-center">
                        {row.original.product_internal_code && (
                            <DataCell.Code>{row.original.product_internal_code}</DataCell.Code>
                        )}
                        {row.original.product_code && row.original.product_code !== row.original.product_internal_code && (
                            <DataCell.Code>
                                {row.original.product_code}
                            </DataCell.Code>
                        )}
                    </div>
                </div>
            ),
        },
        {
            id: "flow",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Origen → Destino" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5 text-center">
                    <DataCell.Text className="text-muted-foreground text-xs">{row.original.source_location_name}</DataCell.Text>
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <DataCell.Text className="text-xs font-medium">{row.original.destination_location_name}</DataCell.Text>
                </div>
            ),
        },
        stockMoveActions.column(actionsCtx),
    ], [actionsCtx])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.stockmove"
                    columns={columns}
                    data={moves}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination
                    pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={pageState}
                    onPaginationChange={setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={stockMoveUnifiedSearchDef}
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
                        placeholder="Buscar movimientos..."
                    />}
                    unifiedSearchConfig={stockMoveUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay movimientos de stock",
                        description: "Los movimientos se registran al recibir, despachar o ajustar inventario.",
                    }}
                    cardGroupBy={{ field: 'date', sort: 'desc' }}
                    renderCard={(move: StockMove) => {
                        return (
                            <EntityCard
                                key={move.id}
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams.toString())
                                    params.set('selected', String(move.id))
                                    router.push(`${pathname}?${params.toString()}`, { scroll: false })
                                }}
                                >
                                <EntityCard.Header
                                    title={move.product_name}
                                    subtitle={move.display_id ?? String(move.id)}
                                />
                                <EntityCard.Body actions={stockMoveActions.render(move, actionsCtx)}>
                                    <EntityCard.Field label="Fecha" value={<DataCell.Date value={move.date} />} />
                                    <EntityCard.Field label="Origen" value={move.source_location_name} />
                                    <EntityCard.Field label="Destino" value={move.destination_location_name} />
                                    <EntityCard.Field label="Cantidad" value={<DataCell.NumericFlow value={move.quantity} unit={move.uom_name} showSign />} />
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

            <BaseModal
                open={showAdjustmentModal || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setShowAdjustmentModal(true)
                    }
                }}
                size="lg"
                hideScrollArea={true}
                contentClassName="p-0"
                icon={ArrowRightLeft}
                title="Nuevo Ajuste de Inventario"
                description="Procedimiento táctico de rectificación de stock físico."
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={handleCloseModal} />
                                <SubmitButton
                                    form="adjustment-form"
                                    loading={isFormLoading}
                                    variant="primary"
                                    className="px-8"
                                >
                                    Confirmar Ajuste
                                </SubmitButton>
                            </>
                        }
                    />
                }
            >
                <AdjustmentForm
                    onLoadingChange={setIsFormLoading}
                    onSuccess={() => {
                        handleCloseModal();
                        refetch();
                    }}
                    onCancel={handleCloseModal}
                />
            </BaseModal>
        </div>
    )
}
