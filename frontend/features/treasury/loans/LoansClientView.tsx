"use client"

import React, { useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { FileText, AlertTriangle } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
    ToolbarCreateButton,
    UnifiedSearchBar, useUnifiedSearch,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useLoans } from '../hooks/useLoans'
import { LoanRegisterDrawer } from './LoanRegisterDrawer'
import { LoanViewDrawer } from './LoanViewDrawer'
import { LoanDisburseDrawer } from './LoanDisburseDrawer'
import { LoanDetailModal } from './LoanDetailModal'
import { loanActions, type LoanActionsCtx } from './loanActions'
import type { BankLoan } from './types'
import { parseDateOnly } from '@/lib/utils'

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

    const isDetailOpen = !!selectedId && (action === "detail" || !action)
    const isDisburseOpen = !!selectedId && action === "disburse"
    const isAmortizationOpen = !!selectedId && action === "amortization"

    const selectedLoan = useMemo(
        () => selectedId ? filteredLoans.find(l => l.id === selectedId) ?? null : null,
        [selectedId, filteredLoans],
    )

    const clearAll = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        const changed = params.has("selected") || params.has("action") || params.has("modal")
        params.delete("selected")
        params.delete("action")
        params.delete("modal")
        if (changed) {
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [router, pathname, searchParams])

    const handleReset = useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const openLoan = useCallback((id: number, actionType: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        params.set("action", actionType)
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    if (isLoading) {
        return <Skeleton className="h-full" />
    }

    if (isError) {
        return (
            <EmptyState
                title="Error al cargar créditos"
                description="Intente nuevamente más tarde."
                icon={AlertTriangle}
            />
        )
    }

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
        {
            accessorKey: 'display_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="ID Interno" />,
            cell: ({ row }) => <DataCell.Code>{row.original.display_id}</DataCell.Code>,
        },
        {
            accessorKey: 'currency',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Moneda" />,
            cell: ({ row }) => (
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold">
                    {row.original.currency}
                </span>
            ),
        },
        {
            accessorKey: 'principal',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Capital" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={parseFloat(row.original.principal)} />
                </div>
            ),
        },
        {
            accessorKey: 'interest_rate',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tasa" className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {parseFloat(row.original.interest_rate).toFixed(2)}% {row.original.rate_basis_display.toLowerCase()}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'term_months',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Plazo" className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Text>{row.original.term_months} meses</DataCell.Text>
            ),
        },
        {
            accessorKey: 'outstanding_balance',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Saldo Insoluto" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay
                        amount={parseFloat(row.original.outstanding_balance)}
                        className={row.original.status === 'ACTIVE' ? 'font-bold' : 'text-muted-foreground'}
                    />
                </div>
            ),
        },
        {
            accessorKey: 'next_due_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Próx. Vencimiento" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {row.original.next_due_date
                        ? parseDateOnly(row.original.next_due_date).toLocaleDateString('es-CL')
                        : '—'}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        loanActions.column(actionsCtx),
    ]

    return (
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
                        <EntityCard onClick={() => openLoan(loan.id, "detail")}>
                            <EntityCard.Header
                                title={loan.display_id}
                                subtitle={loan.loan_number || undefined}
                                trailing={<StatusBadge status={loan.status} />}
                            />
                            <EntityCard.Body actions={loanActions.render(loan, actionsCtx)}>
                                <EntityCard.Field label="Banco" value={loan.lender_name} />
                                <EntityCard.Field
                                    label="Capital"
                                    value={<MoneyDisplay amount={parseFloat(loan.principal)} />}
                                />
                                <EntityCard.Field
                                    label="Saldo Insoluto"
                                    value={
                                        <MoneyDisplay
                                            amount={parseFloat(loan.outstanding_balance)}
                                            className={loan.status === 'ACTIVE' ? 'font-bold' : 'text-muted-foreground'}
                                        />
                                    }
                                />
                                <EntityCard.Field
                                    label="Tasa"
                                    value={`${parseFloat(loan.interest_rate).toFixed(2)}% ${loan.rate_basis_display.toLowerCase()}`}
                                />
                                <EntityCard.Field label="Plazo" value={`${loan.term_months} meses`} />
                                <EntityCard.Field
                                    label="Próx. Vencimiento"
                                    value={loan.next_due_date
                                        ? parseDateOnly(loan.next_due_date).toLocaleDateString('es-CL')
                                        : '—'}
                                />
                            </EntityCard.Body>
                        </EntityCard>
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
    )
}
