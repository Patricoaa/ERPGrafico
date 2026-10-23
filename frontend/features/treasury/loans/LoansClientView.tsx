"use client"

import React, { useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
    ToolbarCreateButton,
    UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, StaleDataBanner,
} from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from '@/components/entity-view'
import type { UnifiedSearchConfig, MultiSelectOption } from '@/types/unified-search'
import { useLoans } from '../hooks/useLoans'
import { useBanks } from '../hooks/useMasterData'
import { LoanRegisterDrawer } from './LoanRegisterDrawer'
import { LoanViewDrawer } from './LoanViewDrawer'
import { LoanDisburseDrawer } from './LoanDisburseDrawer'
import { LoanDetailModal } from './LoanDetailModal'
import { loanActions, type LoanActionsCtx } from './loanActions'
import { bankLoanEntity, bankLoanViews } from '../entity-view/bankLoan.entity'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const LOAN_GROUPS: Record<string, FieldId<typeof bankLoanEntity.fields>> = { status: 'status' }

export function LoansClientView({ bankId: bankIdProp }: { bankId?: number } = {}) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const bankId = bankIdProp ?? (searchParams.get("bank") ? Number(searchParams.get("bank")) : undefined)
    const { banks } = useBanks()
    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(
        () => ({ bank: banks.map((bank) => ({ label: bank.name, value: String(bank.id) })) }),
        [banks],
    )

    const config: UnifiedSearchConfig = useMemo(() => {
        const filters: NonNullable<UnifiedSearchConfig['filters']> = [
            { key: 'loan_status', label: 'Estado', type: 'single', serverParam: 'loan_status', options: [
                { label: 'Activos', value: 'active' },
                { label: 'Finalizados', value: 'completed' },
            ]},
        ]
        if (!bankId) {
            filters.unshift({ key: 'bank', label: 'Banco', type: 'single', serverParam: 'lender', dynamic: true })
        }
        return {
            searchFields: [
                { key: 'search', label: 'ID / N° Préstamo / Banco', serverParam: 'search', clientKey: ['display_id', 'loan_number', 'lender_name'] },
            ],
            filters,
            groupBy: [
                { key: 'status', label: 'Estado', field: 'status' },
            ],
        }
    }, [bankId])
    const search = useUnifiedSearch(config, filterOptions)

    const queryParams = useMemo(() => {
        const params: Record<string, string> = {}
        if (bankId) params.lender = String(bankId)
        if (search.filters.lender) params.lender = search.filters.lender
        return Object.keys(params).length > 0 ? params : undefined
    }, [bankId, search.filters.lender])

    const { data: loans = [], isLoading, isError, refetch } = useLoans(queryParams)

    const isFiltered = search.isFiltered
    const filteredLoans = useMemo(() => {
        const statusFilter = search.filters.loan_status ?? "active"
        let result = loans
        if (statusFilter === "completed") {
            result = loans.filter(l => l.status === "PAID" || l.status === "DEFAULTED")
        } else {
            result = loans.filter(l => l.status === "ACTIVE")
        }
        return search.filterFn(result)
    }, [loans, search.filterFn, search.filters.loan_status])

    const groupBy = search.groupBy ? LOAN_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode('treasury.bankloan')
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        bankLoanEntity,
        { rows: filteredLoans, isLoading, error: isError && loans.length === 0, refetch, isFiltered },
        { pagination: groupBy ? { mode: 'none' } : { mode: 'client' }, groupBy },
    )

    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const action = searchParams.get("action")
    const isCreateOpen = searchParams.get("modal") === "new"
    const { openAction, clearActions } = useEntityRouteActions()

    const isDetailOpen = !!selectedId && (action === "detail" || !action)
    const isDisburseOpen = !!selectedId && action === "disburse"
    const isAmortizationOpen = !!selectedId && action === "amortization"

    const selectedLoan = useMemo(
        () => selectedId ? filteredLoans.find(l => l.id === selectedId) ?? null : null,
        [selectedId, filteredLoans],
    )

    const clearAll = useCallback(() => {
        clearActions()
        const params = new URLSearchParams(searchParams.toString())
        if (params.has("modal")) {
            params.delete("modal")
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [clearActions, router, pathname, searchParams])

    const handleReset = useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const openLoan = useCallback((id: number, actionType: string) => {
        openAction(id, actionType)
    }, [openAction])

    const registerAction = (
        <ToolbarCreateButton
            label="Registrar Crédito"
            onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("modal", "new")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }}
        />
    )

    const actionsCtx: LoanActionsCtx = {
        onViewDetail: (id) => openLoan(id, "detail"),
        onAmortization: (id) => openLoan(id, "amortization"),
        onDisburse: (loan) => openLoan(loan.id, "disburse"),
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {/* Without rows the collection shows its own error state; with cached rows they stay, flagged as stale. */}
            {isError && loans.length > 0 && <StaleDataBanner className="mx-4 mt-2" />}
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(loan) => openLoan(loan.id, "detail")}
                actions={loanActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={registerAction}>
                    <UnifiedSearchBar
                        config={config}
                        {...bindUnifiedSearch(search)}
                        filterOptions={search.filterOptions}
                        placeholder="Buscar por ID, N° préstamo o banco..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={bankLoanViews.table}
                    card={bankLoanViews.card}
                    emptyTitle="No hay créditos registrados"
                    emptyDescription="Registra tu primer crédito bancario para llevar el control de cuotas y amortización."
                    emptyAction={registerAction}
                    onResetFilters={handleReset}
                />
            </Collection.Root>

            <LoanRegisterDrawer
                open={isCreateOpen}
                onOpenChange={(open) => { if (!open) clearAll() }}
                bankId={bankId}
            />
            <LoanViewDrawer
                loanId={selectedId}
                open={isDetailOpen}
                onOpenChange={(open) => { if (!open) clearAll() }}
            />
            <LoanDisburseDrawer
                open={isDisburseOpen}
                onOpenChange={(open) => { if (!open) clearAll() }}
                loan={selectedLoan}
            />
            <LoanDetailModal
                loanId={selectedId}
                open={isAmortizationOpen}
                onOpenChange={(open) => { if (!open) clearAll() }}
            />
        </div>
    )
}
