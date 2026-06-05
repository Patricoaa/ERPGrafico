"use client"

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FileText, AlertTriangle, Plus, Eye, Send } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EmptyState,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useLoans, useLoanMutations } from './hooks'
import { LoanRegisterDrawer } from './LoanRegisterDrawer'
import { LoanDetailModal } from './LoanDetailModal'
import type { BankLoan } from './types'

export function LoansView({ bankId }: { bankId?: number } = {}) {
    const { data: loans = [], isLoading, isError } = useLoans(
        bankId ? { lender: String(bankId) } : undefined,
    )
    const { disburse } = useLoanMutations()

    const [registerOpen, setRegisterOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<number | null>(null)

    const handleDisburse = async (id: number) => {
        if (window.confirm('¿Desembolsar este crédito? Esta acción no se puede deshacer.')) {
            await disburse(id)
        }
    }

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

    const columns: ColumnDef<BankLoan, unknown>[] = [
        {
            accessorKey: 'display_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Crédito" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.Code>{row.original.display_id}</DataCell.Code>
                    <DataCell.Secondary>{row.original.loan_number || '—'}</DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: 'lender_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Banco" />,
            cell: ({ row }) => <DataCell.Text>{row.original.lender_name}</DataCell.Text>,
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
                    {row.original.interest_rate}% {row.original.rate_basis_display.toLowerCase()}
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
        createActionsColumn<BankLoan>({
            renderActions: (loan) => (
                <>
                    <DataCell.Action
                        icon={Eye}
                        title="Ver detalle"
                        onClick={() => setSelectedId(loan.id)}
                    />
                    {loan.status === 'DRAFT' && (
                        <DataCell.Action
                            icon={Send}
                            title="Desembolsar"
                            onClick={() => { void handleDisburse(loan.id) }}
                        />
                    )}
                </>
            ),
        }),
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                {loans.length === 0 ? (
                    <EmptyState
                        title="No hay créditos registrados"
                        description="Registra tu primer crédito bancario para llevar el control de cuotas y amortización."
                        icon={FileText}
                        action={
                            <Button onClick={() => setRegisterOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Registrar Crédito
                            </Button>
                        }
                    />
                ) : (
                    <DataTableView
                        entityLabel="treasury.bankloan"
                        columns={columns as ColumnDef<unknown, unknown>[]}
                        data={loans as unknown[]}
                        variant="embedded"
                        filterColumn="display_id"
                        searchPlaceholder="Buscar por crédito o número..."
                        createAction={
                            <Button onClick={() => setRegisterOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Registrar Crédito
                            </Button>
                        }
                    />
                )}
            </div>

            <LoanRegisterDrawer open={registerOpen} onOpenChange={setRegisterOpen} />
            <LoanDetailModal
                loanId={selectedId}
                open={selectedId != null}
                onOpenChange={(open) => { if (!open) setSelectedId(null) }}
            />
        </div>
    )
}
