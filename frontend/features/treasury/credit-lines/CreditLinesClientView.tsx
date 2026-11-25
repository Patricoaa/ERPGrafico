"use client"

import React, { useState, useEffect, useMemo } from 'react'
import {
    ActionConfirmModal,
    ToolbarCreateButton,
    StaleDataBanner,
} from '@/components/shared'
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from '@/components/entity-view'
import { useCreditLines, useCreditLineMutations } from '../hooks/useCreditLines'
import { creditLineEntity, creditLineViews } from '../entity-view/creditLine.entity'
import { CreditLineDrawer } from './CreditLineDrawer'
import { creditLineActions, type CreditLineActionsCtx } from './creditLineActions'
import type { CreditLine } from './types'
import type { TreasuryAccount } from '../types'
import { treasuryApi } from '@/features/treasury'
import { useConfirmAction } from '@/hooks/useConfirmAction'

interface Props {
    bankId?: number
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */

export function CreditLinesClientView({ bankId }: Props) {
    const { data: creditLines, isLoading, isError, refetch } = useCreditLines({ bank_id: bankId })
    const { remove } = useCreditLineMutations()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingLine, setEditingLine] = useState<CreditLine | null>(null)
    const [bankCheckingAccounts, setBankCheckingAccounts] = useState<TreasuryAccount[]>([])

    const query = useCollectionQuery(creditLineEntity, { sorting: 'client' })
    const { search, groupBy } = query
    const { filterFn } = search
    const filteredData = useMemo(() => filterFn(creditLines ?? []), [filterFn, creditLines])
    const { view, onViewChange } = useCollectionViewMode('treasury.creditline')
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        creditLineEntity,
        { rows: filteredData, isLoading, error: isError && (creditLines ?? []).length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: 'none' } : { mode: 'client' }, groupBy, sorting: query.sorting },
    )

    useEffect(() => {
        if (bankId && !editingLine) {
            treasuryApi.getAccounts({ account_type: 'CHECKING', bank_id: bankId }).then(setBankCheckingAccounts).catch(() => {})
        }
    }, [bankId, editingLine])

    const handleNewLine = () => {
        setEditingLine(null)
        setDrawerOpen(true)
    }

    // Archiving sits in the row menu next to edit: confirm it like every other treasury master.
    const archiveConfirm = useConfirmAction<number>(async (id) => { await remove.mutateAsync(id) })
    const actionsCtx: CreditLineActionsCtx = {
        onEdit: (line) => { setEditingLine(line); setDrawerOpen(true) },
        onArchive: (id) => archiveConfirm.requestConfirm(id),
    }
    const createAction = <ToolbarCreateButton label="Nueva Línea" onClick={handleNewLine} />

    return (
        <div className="space-y-4">
            {/* Without rows the collection shows its own error state; with cached rows they stay, flagged as stale. */}
            {isError && (creditLines?.length ?? 0) > 0 && <StaleDataBanner className="mx-4 mt-2" />}
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                onOpen={(line) => actionsCtx.onEdit(line)}
                actions={creditLineActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={creditLineViews.table}
                    card={creditLineViews.card}
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <CreditLineDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                creditLine={editingLine}
                treasuryAccountId={
                    !editingLine && bankCheckingAccounts.length === 1
                        ? bankCheckingAccounts[0].id
                        : undefined
                }
            />

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title="Archivar línea de crédito"
                description="¿Archivar esta línea de crédito? Dejará de estar disponible para nuevos giros."
                variant="destructive"
            />
        </div>
    )
}
