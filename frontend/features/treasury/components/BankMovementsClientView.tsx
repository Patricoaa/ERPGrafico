"use client"

import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import React from "react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT } from "@/components/entity-view"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { useBanks } from "@/features/treasury/hooks/useMasterData"
import { treasuryMovementEntity, treasuryMovementViews } from "@/features/treasury/entity-view/treasuryMovement.entity"


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
    // Within one bank its filter has no effect: the bank is fixed below.
    const query = useCollectionQuery(treasuryMovementEntity, { filterOptions })
    const { search, groupBy, params } = query

    const allFilters: TreasuryMovementFilters = {
        ...params,
        ...(bankId ? { bank: bankId } : { bank_only: true }),
    }
    const [pageState, setPageState] = useServerPage([allFilters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("treasury.treasurymovement")
    const { movements, totalCount, isLoading, isRefetching, isError, refetch } = useTreasuryMovements({
        ...(allFilters as TreasuryMovementFilters),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    // ADR-0152: `?selected` solo es enlace profundo; abrir un movimiento es `openEntity`.
    useDeepLinkEntity("treasury.treasurymovement")

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
                query={query}
                view={view}
                onViewChange={onViewChange}
                onOpen={(m) => handleViewDetails(m.id)}
                actions={treasuryMovementActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar />
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

        </div>
    )
}
