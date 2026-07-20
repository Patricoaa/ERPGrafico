"use client"

import { useState, useMemo, useEffect } from "react"
import { DataTableView } from '@/components/shared'
import { AutoEntityCard } from '@/components/shared'
import { stockMoveActions, type StockMoveActionsCtx } from "@/features/inventory/stockMoveActions"
import { type ColumnDef } from "@tanstack/react-table"

import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { stockMoveFields, type StockMove } from "@/features/inventory/stockMoveFields"
interface MovementClientViewProps {
    createAction?: React.ReactNode
}

import { useStockMoves } from "@/features/inventory/hooks/useStockMoves"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { stockMoveUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { toast } from "sonner"
import React from "react"



export function MovementClientView({ createAction }: MovementClientViewProps) {
    const search = useUnifiedSearch(stockMoveUnifiedSearchDef)
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, moves, totalCount, isLoading } = useStockMoves({
        ...search.filters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<StockMove>({
        endpoint: '/inventory/stock-moves'
    })
    const { openView } = useEntityRouteActions()

    const viewingTransaction = selectedFromUrl ? { type: 'inventory' as TransactionType, id: selectedFromUrl.id } : null

    const actionsCtx: StockMoveActionsCtx = {
        onViewDetails: (id) => openView(id),
    }

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        ...stockMoveFields.toColumns(),
        stockMoveActions.auto(actionsCtx),
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
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
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
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay movimientos de stock",
                        description: "Los movimientos se registran al recibir, despachar o ajustar inventario.",
                    }}
                    renderCard={(move: StockMove) => {
                        return (
                            <AutoEntityCard
                                key={move.id}
                                data={move}
                                fields={stockMoveFields}
                                entityLabel="inventory.stockmove"
                                actions={stockMoveActions.render(move, actionsCtx)}
                                defaultAction={stockMoveActions.defaultAction(actionsCtx)?.(move) ?? (() => openView(move.id))}

                            />
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
                            clearSelection()
                        }
                    }}
                />
            )}
        </div>
    )
}
