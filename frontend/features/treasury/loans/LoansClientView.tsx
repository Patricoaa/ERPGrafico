"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import React, { useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
    ToolbarCreateButton,
    StaleDataBanner,
} from '@/components/shared'
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from '@/components/entity-view'
import type { MultiSelectOption } from '@/types/unified-search'
import { useLoans } from '../hooks/useLoans'
import { useBanks } from '../hooks/useMasterData'
import { LoanRegisterDrawer } from './LoanRegisterDrawer'
import { LoanDisburseDrawer } from './LoanDisburseDrawer'
import { loanActions, type LoanActionsCtx } from './loanActions'
import { bankLoanEntity, bankLoanViews } from '../entity-view/bankLoan.entity'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

/** Search group keys → entity field ids (grouping uses the formatted cell text). */

export function LoansClientView({ bankId: bankIdProp }: { bankId?: number } = {}) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const bankId = bankIdProp ?? (searchParams.get("bank") ? Number(searchParams.get("bank")) : undefined)
    const { banks } = useBanks()
    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(
        () => ({ lender: banks.map((bank) => ({ label: bank.name, value: String(bank.id) })) }),
        [banks],
    )

    // Within one bank its filter has no effect: the lender is fixed below.
    const query = useCollectionQuery(bankLoanEntity, { filterOptions, sorting: 'client' })
    const { search, groupBy } = query
    const { filters } = search

    const queryParams = useMemo(() => {
        const params: Record<string, string> = {}
        if (filters.lender) params.lender = filters.lender
        if (bankId) params.lender = String(bankId)
        return Object.keys(params).length > 0 ? params : undefined
    }, [bankId, filters.lender])

    const { data: loans = [], isLoading, isError, refetch } = useLoans(queryParams)

    const isFiltered = search.isFiltered
    // Filtered here: `loan_status` groups row statuses, which `search.filterFn` cannot express.
    const filteredLoans = useMemo(() => {
        const completed = filters.loan_status === "completed"
        const text = filters.search?.toLowerCase()
        return loans.filter((l) =>
            (completed ? l.status === "PAID" || l.status === "DEFAULTED" : l.status === "ACTIVE") &&
            (!text || [l.display_id, l.loan_number, l.lender_name].some((v) => String(v ?? "").toLowerCase().includes(text))),
        )
    }, [loans, filters.loan_status, filters.search])

    const { view, onViewChange } = useCollectionViewMode('treasury.bankloan')
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        bankLoanEntity,
        { rows: filteredLoans, isLoading, error: isError && loans.length === 0, refetch, isFiltered },
        { pagination: groupBy ? { mode: 'none' } : { mode: 'client' }, groupBy, sorting: query.sorting },
    )

    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const { openAction } = useEntityRouteActions()

    // Registrar (`?modal=new`) y desembolsar (`?action=disburse`) son pestañas de página; el detalle de cada
    // crédito abre su propia pestaña (ADR-0152).
    const { openEntity } = useGlobalModals()
    useDeepLinkEntity("treasury.bankloan", { actions: [null, "detail"] })
    const registerPanel = useCreatePanelRoute({ actions: [] })
    const disbursePanel = useCreatePanelRoute({ actions: ['disburse'], create: false })

    const handleReset = useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const openLoan = useCallback((id: number, actionType: string) => {
        if (actionType === "detail") openEntity("treasury.bankloan", id)
        else openAction(id, actionType)
    }, [openAction, openEntity])

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
        onDisburse: (loan) => openLoan(loan.id, "disburse"),
        onPayNext: (id) => openLoan(id, "detail"),
        onPrepay: (id) => openLoan(id, "detail"),
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {/* Without rows the collection shows its own error state; with cached rows they stay, flagged as stale. */}
            {isError && loans.length > 0 && <StaleDataBanner className="mx-4 mt-2" />}
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                actions={loanActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={registerAction} />
                <Collection.View
                    table={bankLoanViews.table}
                    card={bankLoanViews.card}
                    emptyTitle="No hay créditos registrados"
                    emptyDescription="Registra tu primer crédito bancario para llevar el control de cuotas y amortización."
                    emptyAction={registerAction}
                    onResetFilters={handleReset}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.bankloan" {...registerPanel.tab}>
                {(open) => (
                    <LoanRegisterDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) registerPanel.close() }}
                        bankId={bankId}
                    />
                )}
            </EntityPanelTab>
            <EntityPanelTab label="treasury.bankloan" variant="disburse" display="Desembolso" {...disbursePanel.tab}>
                {(open) => (
                    <LoanDisburseDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) disbursePanel.close() }}
                        loan={filteredLoans.find(l => l.id === selectedId) ?? null}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}
