"use client"

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FileText, AlertTriangle, Plus } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useLoans } from './hooks'
import { LoanRegisterDrawer } from './LoanRegisterDrawer'
import { LoanViewDrawer } from './LoanViewDrawer'
import { LoanDisburseDrawer } from './LoanDisburseDrawer'
import { LoanDetailModal } from './LoanDetailModal'
import { loanActions, type LoanActionsCtx } from './loanActions'
import type { BankLoan } from './types'

export function LoansView({ bankId }: { bankId?: number } = {}) {
    const { data: loans = [], isLoading, isError } = useLoans(
        bankId ? { lender: String(bankId) } : undefined,
    )

    const [registerOpen, setRegisterOpen] = useState(false)
    const [disburseOpen, setDisburseOpen] = useState(false)
    const [disburseLoan, setDisburseLoan] = useState<BankLoan | null>(null)
    const [viewLoanId, setViewLoanId] = useState<number | null>(null)
    const [amortizationLoanId, setAmortizationLoanId] = useState<number | null>(null)

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
        <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar Crédito
        </Button>
    )

    const actionsCtx: LoanActionsCtx = {
        onViewDetail: setViewLoanId,
        onAmortization: setAmortizationLoanId,
        onDisburse: (loan) => { setDisburseLoan(loan); setDisburseOpen(true) },
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
                        ? new Date(row.original.next_due_date).toLocaleDateString('es-CL')
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
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.bankloan"
                    columns={columns}
                    data={loans}
                    variant="embedded"
                    createAction={registerAction}
                    emptyState={{
                        context: 'treasury',
                        icon: FileText,
                        title: 'No hay créditos registrados',
                        description: 'Registra tu primer crédito bancario para llevar el control de cuotas y amortización.',
                    }}
                    renderCard={(loan: BankLoan) => (
                        <EntityCard actions={loanActions.render(loan, actionsCtx)}>
                            <EntityCard.Header
                                title={loan.display_id}
                                subtitle={loan.loan_number || undefined}
                                trailing={<StatusBadge status={loan.status} />}
                            />
                            <EntityCard.Body>
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
                                        ? new Date(loan.next_due_date).toLocaleDateString('es-CL')
                                        : '—'}
                                />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

            <LoanRegisterDrawer
                open={registerOpen}
                onOpenChange={setRegisterOpen}
                bankId={bankId}
            />
            <LoanViewDrawer
                loanId={viewLoanId}
                open={viewLoanId != null}
                onOpenChange={(open) => { if (!open) setViewLoanId(null) }}
            />
            <LoanDisburseDrawer
                open={disburseOpen}
                onOpenChange={(open) => {
                    setDisburseOpen(open)
                    if (!open) setDisburseLoan(null)
                }}
                loan={disburseLoan}
            />
            <LoanDetailModal
                loanId={amortizationLoanId}
                open={amortizationLoanId != null}
                onOpenChange={(open) => { if (!open) setAmortizationLoanId(null) }}
            />
        </div>
    )
}
