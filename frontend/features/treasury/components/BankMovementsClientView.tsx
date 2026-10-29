"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import React from "react"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT, type FieldId } from "@/components/entity-view"
import type { UnifiedSearchConfig } from '@/types/unified-search'

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { useBanks } from "@/features/treasury/hooks/useMasterData"
import { treasuryMovementsUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import type { TreasuryMovement } from "@/features/treasury/types"
import { treasuryMovementEntity, treasuryMovementViews } from "@/features/treasury/entity-view/treasuryMovement.entity"

import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const MOVEMENT_GROUPS: Record<string, FieldId<typeof treasuryMovementEntity.fields>> = { date: "date", movement_type: "movementType", payment_method: "paymentMethod" }
const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

interface BankMovementsClientViewProps {
    /** Banco específico. Si se omite, agrega los movimientos de todas las cuentas bancarias. */
    bankId?: number
}

export function BankMovementsClientView({ bankId }: BankMovementsClientViewProps = {}) {
    const { openEntity } = useGlobalModalActions()
    const { banks } = useBanks()
    const filterOptions = React.useMemo(
        () => ({ bank: banks.map((bank) => ({ label: bank.name, value: String(bank.id) })) }),
        [banks],
    )
    const config = React.useMemo<UnifiedSearchConfig>(() => {
        const filters = [...(treasuryMovementsUnifiedSearchDef.filters ?? [])]
        if (!bankId) {
            filters.unshift({
                type: 'single',
                key: 'bank',
                label: 'Banco',
                serverParam: 'bank',
                dynamic: true,
            })
        }
        return { ...treasuryMovementsUnifiedSearchDef, filters }
    }, [bankId])
    const search = useUnifiedSearch(config, filterOptions)

    const allFilters: TreasuryMovementFilters = {
        ...search.filters,
        ...(bankId ? { bank: bankId } : { bank_only: true }),
    }
    const groupBy = search.groupBy ? MOVEMENT_GROUPS[search.groupBy] ?? null : null
    const [pageState, setPageState] = useServerPage([allFilters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("treasury.treasurymovement")
    const { movements, totalCount, isLoading, isRefetching, isError, refetch } = useTreasuryMovements({
        ...(allFilters as TreasuryMovementFilters),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const panel = useEntityPanelRoute<TreasuryMovement>({ endpoint: '/treasury/movements', create: false })

    const handleViewDetails = React.useCallback((id: number) => {
        openEntity("treasury.treasurymovement", id)
    }, [openEntity])

    const actionsCtx: TreasuryMovementActionsCtx = React.useMemo(
        () => ({ onDetail: handleViewDetails }),
        [handleViewDetails]
    )

    const collection = useEntityCollection(
        treasuryMovementEntity,
        { rows: movements, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(m) => handleViewDetails(m.id)}
                actions={treasuryMovementActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={config}
                        {...bindUnifiedSearch(search)}
                        filterOptions={search.filterOptions}
                        placeholder="Buscar movimiento..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={treasuryMovementViews.table}
                    card={treasuryMovementViews.card}
                    emptyTitle="Aún no hay movimientos bancarios"
                    emptyDescription={bankId
                        ? "Los movimientos registrados en las cuentas de este banco aparecerán aquí."
                        : "Los movimientos registrados en las cuentas bancarias aparecerán aquí."}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.bankmovement" {...panel.tab}>
                {(open) => panel.selectedId && (
                    <CashMovementDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}
