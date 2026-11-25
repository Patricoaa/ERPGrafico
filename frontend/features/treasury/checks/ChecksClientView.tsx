"use client"

import React, { useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import type { MultiSelectOption } from '@/types/unified-search'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { useChecks, useCheckMutations } from '../hooks/useChecks'
import { CheckDepositModal } from './CheckDepositModal'
import { checkActions, type CheckActionsCtx } from './checkActions'
import { useBanks } from '@/features/treasury'
import { checkEntity, checkViews } from '../entity-view/check.entity'
import type { Check, CheckDirection } from './types'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

/** Search group keys → entity field ids (grouping uses the formatted cell text). */

const ACTIONABLE_FROM: Record<string, string[]> = {
    deposit:     ['IN_PORTFOLIO'],
    clear:       ['DEPOSITED'],
    bounce:      ['DEPOSITED'],
    void:        ['IN_PORTFOLIO', 'ISSUED'],
    mark_cashed: ['ISSUED'],
}

interface ChecksClientViewProps {
    bankId?: number
    direction?: CheckDirection
}

export function ChecksClientView({ bankId, direction }: ChecksClientViewProps = {}) {
    const searchParams = useSearchParams()

    const { openEntity } = useGlobalModals()

    const { banks } = useBanks()

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        bank: banks.map((b) => ({ label: b.name, value: String(b.id) })),
    }), [banks])

    const query = useCollectionQuery(checkEntity, { filterOptions, sorting: "client" })
    const { search, groupBy } = query

    const queryParams = useMemo(() => {
        const p: Record<string, string> = { ...query.params }
        if (bankId && !p.bank) p.bank = String(bankId)
        if (direction) p.direction = direction
        return Object.keys(p).length ? p : undefined
    }, [query.params, bankId, direction])

    const { checks = [], isLoading, isRefetching, isError, refetch } = useChecks(queryParams)
    const { view, onViewChange } = useCollectionViewMode("treasury.check")

    const { clear, bounce, void: voidCheck, markCashed } = useCheckMutations()

    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const action = searchParams.get("action")
    const isDepositOpen = !!selectedId && action === "deposit"
    const { openAction, clearActions } = useEntityRouteActions()

    const depositCheck = useMemo(
        () => isDepositOpen ? checks.find(c => c.id === selectedId) ?? null : null,
        [selectedId, isDepositOpen, checks],
    )

    const clearModalParams = useCallback(() => {
        clearActions()
    }, [clearActions])

    const isFiltered = search.isFiltered

    const handleViewDetail = useCallback(
        (id: number) => {
            const check = checks.find((c) => c.id === id)
            if (check) openEntity('treasury.check', id, check)
        },
        [checks, openEntity],
    )

    const handleReset = useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const canDo = (action: string, check: Check) =>
        ACTIONABLE_FROM[action]?.includes(check.status) ?? false

    const isIssued = direction === 'ISSUED'

    const actionsCtx: CheckActionsCtx = {
        isIssued,
        canDo,
        onViewDetail: handleViewDetail,
        onDeposit: (check) => openAction(check.id, "deposit"),
        onClear: (id) => clear(id),
        onBounce: (id) => bounce({ id }),
        onMarkCashed: (id) => markCashed(id),
        onVoid: (id) => voidCheck({ id }),
    }

    const collection = useEntityCollection(
        checkEntity,
        { rows: checks, isLoading, isRefetching, error: isError, refetch, isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                onOpen={(check) => handleViewDetail(check.id)}
                actions={checkActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={checkViews.table}
                    card={checkViews.card}
                    emptyTitle={isIssued ? 'Sin cheques girados' : 'Sin cheques en cartera'}
                    emptyDescription={isIssued ? 'Los cheques propios emitidos en compras aparecerán aquí.' : 'Los cheques recibidos en ventas o registro de pagos aparecerán aquí.'}
                    onResetFilters={handleReset}
                />
            </Collection.Root>

            {depositCheck && (
                <CheckDepositModal
                    check={depositCheck}
                    open={isDepositOpen}
                    onOpenChange={(open) => { if (!open) clearModalParams() }}
                />
            )}
        </div>
    )
}
