"use client"

import React, { useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    DataTableView,
    SkeletonShell, AutoEntityCard,
    UnifiedSearchBar, useUnifiedSearch,
} from '@/components/shared'
import type { UnifiedSearchConfig, MultiSelectOption } from '@/types/unified-search'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { useChecks, useCheckMutations } from '../hooks/useChecks'
import { CheckDepositModal } from './CheckDepositModal'
import { checkActions, type CheckActionsCtx } from './checkActions'
import { useBanks } from '@/features/treasury'
import { checkFields } from './checkFields'
import type { Check, CheckDirection } from './types'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

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

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'N° Cheque / Girador / Monto', serverParam: 'search' },
        ],
        filters: [
            { key: 'bank', label: 'Banco', type: 'single', serverParam: 'bank', dynamic: true },
            { key: 'status', label: 'Estado', type: 'single', serverParam: 'status', options: [
                { label: 'En Cartera', value: 'IN_PORTFOLIO' },
                { label: 'Depositado', value: 'DEPOSITED' },
                { label: 'Cobrado', value: 'CLEARED' },
                { label: 'Protestado', value: 'BOUNCED' },
                { label: 'Anulado', value: 'VOIDED' },
            ]},
        ],
        dateFilters: [{
            key: 'due_date',
            label: 'Vencimiento',
            type: 'date',
            options: [
                { label: 'Personalizado', value: 'custom', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before' },
            ],
        }],
        groupBy: [
            { key: 'status', label: 'Estado', field: 'status' },
            { key: 'direction', label: 'Dirección', field: 'direction' },
        ],
    }), [])
    const search = useUnifiedSearch(config, filterOptions)

    const queryParams = useMemo(() => {
        const p: Record<string, string> = { ...search.filters }
        if (bankId && !p.bank) p.bank = String(bankId)
        if (direction) p.direction = direction
        return Object.keys(p).length ? p : undefined
    }, [search.filters, bankId, direction])

    const { checks = [], isLoading } = useChecks(queryParams)

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

    const columns = [
        ...checkFields.toColumns(),
        checkActions.auto(actionsCtx),
    ]

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando cheques">
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.check"
                    columns={columns}
                    data={checks}
                    isLoading={isLoading}
                    variant="embedded"
                    emptyState={
                        isIssued
                            ? { context: 'treasury', title: 'Sin cheques girados', description: 'Los cheques propios emitidos en compras aparecerán aquí.' }
                            : { context: 'treasury', title: 'Sin cheques en cartera', description: 'Los cheques recibidos en ventas o registro de pagos aparecerán aquí.' }
                    }
                    unifiedSearch={<UnifiedSearchBar
                        config={config}
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
                        filterOptions={search.filterOptions}
                        placeholder="Buscar por N° cheque, girador o monto..."
                    />}
                    isFiltered={isFiltered}
                    showReset={isFiltered}
                    onReset={handleReset}
                    renderCard={(check: Check) => (
                        <AutoEntityCard 
                            key={check.id}
                            data={check}
                            fields={checkFields}

                            entityLabel="treasury.check"

                            actions={checkActions.render(check, actionsCtx)}
                        />
                    )}
                />
            </div>

            {depositCheck && (
                <CheckDepositModal
                    check={depositCheck}
                    open={isDepositOpen}
                    onOpenChange={(open) => { if (!open) clearModalParams() }}
                />
            )}
        </div>
        </SkeletonShell>
    )
}
