"use client"

import React, { useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { FileText } from 'lucide-react'
import {
    DataTableView,
    SkeletonShell, AutoEntityCard,
    ToolbarCreateButton,
    UnifiedSearchBar, useUnifiedSearch, StaleDataBanner,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useLoans } from '../hooks/useLoans'
import { LoanRegisterDrawer } from './LoanRegisterDrawer'
import { LoanViewDrawer } from './LoanViewDrawer'
import { LoanDisburseDrawer } from './LoanDisburseDrawer'
import { LoanDetailModal } from './LoanDetailModal'
import { loanActions, type LoanActionsCtx } from './loanActions'
import type { BankLoan } from './types'
import { loanFields } from './loanFields'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

export function LoansClientView({ bankId: bankIdProp }: { bankId?: number } = {}) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const bankId = bankIdProp ?? (searchParams.get("bank") ? Number(searchParams.get("bank")) : undefined)
    const { data: loans = [], isLoading, isError } = useLoans(
        bankId ? { lender: String(bankId) } : undefined,
    )

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'ID / N° Préstamo / Banco', serverParam: 'search', clientKey: ['display_id', 'loan_number', 'lender_name'] },
        ],
        filters: [
            { key: 'loan_status', label: 'Estado', type: 'single', serverParam: 'loan_status', options: [
                { label: 'Activos', value: 'active' },
                { label: 'Finalizados', value: 'completed' },
            ]},
        ],
        groupBy: [
            { key: 'status', label: 'Estado', field: 'status' },
        ],
    }), [])
    const search = useUnifiedSearch(config)
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

    const columns: ColumnDef<BankLoan>[] = [
        ...loanFields.toColumns(),
        loanActions.auto(actionsCtx),
    ]

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando créditos">
        {isError && <StaleDataBanner className="mx-4 mt-2" />}
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.bankloan"
                    columns={columns}
                    data={filteredLoans}
                    variant="embedded"
                    createAction={registerAction}
                    isFiltered={isFiltered}
                    showReset={isFiltered}
                    onReset={handleReset}
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
                        placeholder="Buscar por ID, N° préstamo o banco..."
                    />}
                    emptyState={{
                        context: 'treasury',
                        icon: FileText,
                        title: 'No hay créditos registrados',
                        description: 'Registra tu primer crédito bancario para llevar el control de cuotas y amortización.',
                    }}
                    renderCard={(loan: BankLoan) => (
                        <AutoEntityCard 
                            key={loan.id}
                            data={loan}
                            fields={loanFields}
                            entityLabel="treasury.bankloan"
                            onClick={() => openLoan(loan.id, "detail")} 
                            defaultAction={loanActions.defaultAction(actionsCtx)?.(loan) ?? null}

                            actions={loanActions.render(loan, actionsCtx)}

                        />
                    )}
                />
            </div>

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
        </SkeletonShell>
    )
}
