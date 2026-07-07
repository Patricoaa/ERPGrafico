"use client"

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Banknote, AlertCircle, Calendar, TrendingDown, DollarSign, Eye, FileQuestion } from 'lucide-react'
import {
    BaseModal, FormFooter, ActionSlideButton, StatCard,
    Skeleton, EmptyState, DataTable, DataTableColumnHeader, DataCell,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useLoan } from '../hooks/useLoans'
import { LoanPayInstallmentModal } from './LoanPayInstallmentModal'
import { PrepayLoanModal } from './PrepayLoanModal'
import { LoanInstallmentReadonlyModal } from './LoanInstallmentReadonlyModal'
import type { LoanInstallment } from './types'
import { parseDateOnly } from '@/lib/utils'

interface Props {
    loanId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LoanDetailModal({ loanId, open, onOpenChange }: Props) {
    const { data: loan, isLoading, isError } = useLoan(loanId)

    const [payingInst, setPayingInst] = useState<LoanInstallment | null>(null)
    const [viewingInst, setViewingInst] = useState<LoanInstallment | null>(null)
    const [showPrepayModal, setShowPrepayModal] = useState(false)
    const [showFeeDetail, setShowFeeDetail] = useState(false)

    if (!open) return null
    if (isLoading) return (
        <BaseModal open={open} onOpenChange={onOpenChange} title="Cargando crédito…">
            <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-64" />
            </div>
        </BaseModal>
    )
    if (isError || !loan) return (
        <BaseModal open={open} onOpenChange={onOpenChange} title="Error">
            <EmptyState
                title="No se pudo cargar el crédito"
                description="Intente nuevamente."
                icon={AlertCircle}
            />
        </BaseModal>
    )

    const fmt = (val: string) => {
        const n = parseFloat(val)
        if (loan.currency === 'UF') {
            return `${Math.round(n).toLocaleString('es-CL')} UF`
        }
        return new Intl.NumberFormat('es-CL', {
            style: 'currency', currency: 'CLP',
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(n)
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={
                    <div className="flex items-center gap-3">
                        <Banknote className="h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col">
                            <span>{loan.display_id} · {loan.lender_name}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    {loan.liability_account_name}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold">
                                    {loan.currency}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    {loan.interest_rate}% {loan.rate_basis_display.toLowerCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                }
                size="full"
                footer={
                    loan.status === 'ACTIVE' ? (
                        <FormFooter
                            actions={
                                <ActionSlideButton
                                    variant="destructive"
                                    onClick={() => setShowPrepayModal(true)}
                                >
                                    Prepago Total
                                </ActionSlideButton>
                            }
                        />
                    ) : undefined
                }
            >
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <StatCard label="Capital" value={fmt(loan.principal)} icon={Banknote} accent="info" />
                        <StatCard label="Saldo Insoluto" value={fmt(loan.outstanding_balance)} icon={TrendingDown} accent="warning" />
                        <StatCard label="Cuotas Pagadas" value={`${loan.paid_installments_count} / ${loan.installments_count}`} icon={Calendar} accent="success" />
                        <StatCard
                            label="Próx. Vencimiento"
                            value={loan.next_due_date
                                ? parseDateOnly(loan.next_due_date).toLocaleDateString('es-CL')
                                : '—'}
                            icon={Calendar}
                            accent="info"
                        />
                        <StatCard label="Total Desembolsado" value={fmt(loan.total_disbursed || '0')} icon={DollarSign} accent="info" />
                    </div>

                    {/* Amortization table */}
                    <div className="overflow-hidden">
                        <div className="px-4 py-3 bg-muted/50">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Tabla de Amortización
                            </h3>
                        </div>
                        {(() => {
                            const openingFee = parseFloat(loan.opening_fee)
                            const stampTax = parseFloat(loan.stamp_tax)
                            const feeTotal = openingFee + stampTax

                            const syntheticFeeRow: LoanInstallment | null = feeTotal > 0 ? {
                                id: -1,
                                display_id: '',
                                loan: loan.id,
                                loan_display_id: loan.display_id,
                                number: 0,
                                due_date: loan.start_date,
                                principal_amount: '0',
                                interest_amount: '0',
                                insurance_amount: '0',
                                total_amount: feeTotal.toFixed(2),
                                outstanding_balance: loan.principal,
                                status: 'PAID',
                                status_display: 'Pagado',
                                is_overdue: false,
                                paid_at: null,
                                payment_movement: null,
                                uf_value_used: null,
                                clp_amount_paid: null,
                                penalty_paid: '0',
                                notes: '',
                            } : null

                            const tableData = syntheticFeeRow
                                ? [syntheticFeeRow, ...loan.installments]
                                : loan.installments

                            const columns: ColumnDef<LoanInstallment>[] = [
                                {
                                    accessorKey: 'number',
                                    header: '#',
                                    cell: ({ row }) => <DataCell.Text>{row.original.number}</DataCell.Text>,
                                },
                                {
                                    accessorKey: 'due_date',
                                    header: 'Vencimiento',
                                    cell: ({ row }) => <DataCell.Date value={row.original.due_date} />,
                                },
                                {
                                    accessorKey: 'principal_amount',
                                    header: ({ column }) => <DataTableColumnHeader column={column} title="Capital" />,
                                    cell: ({ row }) => <DataCell.Currency value={row.original.principal_amount} digits={0} />,
                                },
                                {
                                    accessorKey: 'interest_amount',
                                    header: ({ column }) => <DataTableColumnHeader column={column} title="Interés" />,
                                    cell: ({ row }) => <DataCell.Currency value={row.original.interest_amount} digits={0} />,
                                },
                                {
                                    id: 'others',
                                    header: ({ column }) => <DataTableColumnHeader column={column} title="Otros" />,
                                    cell: ({ row }) => {
                                        if (row.original.number === 0) {
                                            return <DataCell.Currency value={feeTotal.toFixed(2)} digits={0} />
                                        }
                                        const insurance = parseFloat(row.original.insurance_amount)
                                        const penalty = parseFloat(row.original.penalty_paid)
                                        return <DataCell.Currency value={(insurance + penalty).toFixed(2)} digits={0} />
                                    },
                                },
                                {
                                    accessorKey: 'total_amount',
                                    header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
                                    cell: ({ row }) => <DataCell.Currency value={row.original.total_amount} digits={0} />,
                                },
                                {
                                    accessorKey: 'outstanding_balance',
                                    header: ({ column }) => <DataTableColumnHeader column={column} title="Saldo" />,
                                    cell: ({ row }) => (
                                        <DataCell.Currency value={row.original.outstanding_balance} digits={0} />
                                    ),
                                },
                                {
                                    accessorKey: 'status',
                                    header: 'Estado',
                                    cell: ({ row }) => <DataCell.Status status={row.original.status} />,
                                },
                                {
                                    id: 'actions',
                                    header: '',
                                    cell: ({ row }) => {
                                        const inst = row.original
                                        if (inst.number === 0) {
                                            return (
                                                <Button size="sm" variant="outline" onClick={() => setShowFeeDetail(true)} title="Ver detalle">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            )
                                        }
                                        if (inst.status === 'PENDING' || inst.status === 'OVERDUE') {
                                            return (
                                                <Button size="sm" variant="outline" onClick={() => setPayingInst(inst)} title="Pagar">
                                                    <DollarSign className="h-3.5 w-3.5" />
                                                </Button>
                                            )
                                        }
                                        if (inst.status === 'PAID') {
                                            return (
                                                <Button size="sm" variant="outline" onClick={() => setViewingInst(inst)} title="Ver detalle">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            )
                                        }
                                        return null
                                    },
                                },
                            ]
                            return (
                                <DataTable
                                    columns={columns}
                                    data={tableData}
                                    variant="minimal"
                                    noBorder
                                    hidePagination
                                    emptyState={{
                                        title: 'Tabla aún no generada',
                                        description: 'Desembolsa el crédito para crearla.',
                                        icon: FileQuestion,
                                    }}
                                />
                            )
                        })()}
                    </div>

                    {loan.notes && (
                        <div className="rounded-md border border-border p-4">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</h4>
                            <p className="text-sm whitespace-pre-wrap">{loan.notes}</p>
                        </div>
                    )}
                </div>
            </BaseModal>

            {payingInst && (
                <LoanPayInstallmentModal
                    installment={payingInst}
                    loanCurrency={loan.currency}
                    penaltyRate={loan.penalty_rate}
                    open={true}
                    onOpenChange={(o) => { if (!o) setPayingInst(null) }}
                />
            )}

            {showPrepayModal && (
                <PrepayLoanModal
                    loan={loan}
                    open={true}
                    onOpenChange={(o) => { if (!o) setShowPrepayModal(false) }}
                />
            )}

            {viewingInst && (
                <LoanInstallmentReadonlyModal
                    installment={viewingInst}
                    loanDisplayId={loan.display_id}
                    loanCurrency={loan.currency}
                    open={true}
                    onOpenChange={(o) => { if (!o) setViewingInst(null) }}
                />
            )}

            {showFeeDetail && (
                <BaseModal
                    open={true}
                    onOpenChange={(o) => { if (!o) setShowFeeDetail(false) }}
                    title="Detalle de Cargos Iniciales"
                >
                    <div className="space-y-4 p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Capital del crédito</span>
                            <span className="font-semibold">{fmt(loan.principal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive">
                            <span className="text-sm">Comisión de apertura</span>
                            <span>-{fmt(loan.opening_fee)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive">
                            <span className="text-sm">Impuesto de timbres</span>
                            <span>-{fmt(loan.stamp_tax)}</span>
                        </div>
                        <hr className="border-border" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold">Total desembolsado</span>
                            <span className="font-bold">{fmt((parseFloat(loan.principal) - parseFloat(loan.opening_fee) - parseFloat(loan.stamp_tax)).toFixed(2))}</span>
                        </div>
                    </div>
                </BaseModal>
            )}
        </>
    )
}
