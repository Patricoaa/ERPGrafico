"use client"

import React, { useState, useEffect } from "react"
import { DataTableView, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { resolveTreasuryMovementIcon } from "@/lib/movement-icons"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { treasuryMovementsUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { toast } from "sonner"
import type { TreasuryMovement } from "@/features/treasury/types"
import { movementFields } from "@/features/treasury/movementFields"

import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"

interface BankMovementsClientViewProps {
    bankId: number
}

export function BankMovementsClientView({ bankId }: BankMovementsClientViewProps) {
    const { openEntity } = useGlobalModalActions()
    const search = useUnifiedSearch(treasuryMovementsUnifiedSearchDef)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const allFilters = {
        ...search.filters,
        bank: bankId,
    }
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, movements, totalCount, isLoading } = useTreasuryMovements({
        ...(allFilters as TreasuryMovementFilters),
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 200 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 200
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryMovement>({
        endpoint: '/treasury/movements'
    })

    const detailsOpen = !!selectedFromUrl
    const selectedMovementId = selectedFromUrl?.id ?? null

    const handleViewDetails = React.useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleReset = React.useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const actionsCtx: TreasuryMovementActionsCtx = { onDetail: handleViewDetails }

    const columns = React.useMemo<ColumnDef<TreasuryMovement>[]>(() => [
        ...movementFields.toColumns(),
        treasuryMovementActions.auto(actionsCtx)
    ], [openEntity, handleViewDetails])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.treasurymovement"
                    columns={columns}
                    data={movements}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 200 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={treasuryMovementsUnifiedSearchDef}
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
                        placeholder="Buscar movimiento..."
                    />}
                    unifiedSearchConfig={treasuryMovementsUnifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered}
                    onReset={handleReset}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay movimientos bancarios",
                        description: "Los movimientos registrados en las cuentas de este banco aparecerán aquí.",
                    }}
                    renderCard={(m) => {
                        const { icon, iconClassName } = resolveTreasuryMovementIcon(m)

                        return (
                            <AutoEntityCard 
                                key={m.id} 
                                data={m}
                                fields={movementFields}
                                entityLabel="treasury.bankmovement"
                                onClick={() => handleViewDetails(m.id)}
                                icon={icon}
                                iconClassName={iconClassName}
                                actions={treasuryMovementActions.render(m, { onDetail: (id) => handleViewDetails(id) })}

                            />
                        )
                    }}
                    cardSkeleton={{ showBody: false }}
                />
            </div>

            {selectedMovementId && (
                <CashMovementDrawer
                    id={selectedMovementId}
                    open={detailsOpen}
                    onOpenChange={(open) => {
                        if (!open) clearSelection()
                    }}
                />
            )}
        </div>
    )
}
