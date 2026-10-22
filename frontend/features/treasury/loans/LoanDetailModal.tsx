"use client"

import React, { useState, useMemo } from 'react'
import { Banknote, AlertCircle, Calendar, TrendingDown, DollarSign, Eye } from 'lucide-react'
import { BaseModal, FormFooter, DangerButton, StatCard, Skeleton, EmptyState, StaleDataBanner, Chip } from "@/components/shared"
import { Button } from '@/components/ui/button'
import { useLoan } from '../hooks/useLoans'
import { LoanPayInstallmentModal } from './LoanPayInstallmentModal'
import { PrepayLoanModal } from './PrepayLoanModal'
import { LoanInstallmentReadonlyModal } from './LoanInstallmentReadonlyModal'
import type { LoanInstallment } from './types'
import { Collection, useEntityCollection, formatMoneyValue, formatDate } from '@/components/entity-view'
import { loanInstallmentEntity, loanInstallmentViews, type LoanInstallmentRow } from '../entity-view/loanInstallment.entity'

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

    const tableData = useMemo<LoanInstallmentRow[]>(() => {
        if (!loan) return []
        const openingFee = parseFloat(loan.opening_fee)
        const stampTax = parseFloat(loan.stamp_tax)
        const feeTotal = openingFee + stampTax
        const syntheticFeeRow: LoanInstallmentRow | null = feeTotal > 0 ? {
            id: -1, display_id: '', loan: loan.id, loan_display_id: loan.display_id,
            number: 0, due_date: loan.start_date, principal_amount: '0', interest_amount: '0',
            insurance_amount: '0', total_amount: feeTotal.toFixed(2),
            outstanding_balance: loan.principal, status: 'PAID', status_display: 'Pagado',
            is_overdue: false, paid_at: null, payment_movement: null,
            uf_value_used: null, clp_amount_paid: null, penalty_paid: '0', notes: '',
            _feeTotal: feeTotal,
        } : null
        return syntheticFeeRow ? [syntheticFeeRow, ...loan.installments] : loan.installments
    }, [loan])

    const amortizationCollection = useEntityCollection(
        loanInstallmentEntity,
        { rows: tableData },
        { pagination: { mode: "none" } }
    )

    if (!open) return null
    if (isLoading) return (
        <BaseModal open={open} onOpenChange={onOpenChange} title="Cargando crédito…">
            <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-64" />
            </div>
        </BaseModal>
    )
    if (!loan) return (
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
            // eslint-disable-next-line entity-view/no-adhoc-format -- UF is not ISO 4217; formatMoneyValue can't handle it
            return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))} UF`
        }
        return formatMoneyValue(n, 'CLP')
    }

    const isActive = loan.status === 'ACTIVE'

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
                                <Chip size="sm" intent="neutral">
                                    {loan.liability_account_name}
                                </Chip>
                                <Chip size="sm" intent="neutral">
                                    {loan.currency}
                                </Chip>
                                <Chip size="sm" intent="neutral">
                                    {loan.interest_rate}% {loan.rate_basis_display.toLowerCase()}
                                </Chip>
                            </div>
                        </div>
                    </div>
                }
                size="full"
                footer={
                    isActive ? (
                        <FormFooter
                            actions={
                                <DangerButton
                                    variant="destructive"
                                    onClick={() => setShowPrepayModal(true)}
                                >
                                    Prepago Total
                                </DangerButton>
                            }
                        />
                    ) : undefined
                }
            >
                {isError && <StaleDataBanner className="mx-4 mt-2" />}
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <StatCard label="Capital" value={fmt(loan.principal)} icon={Banknote} accent="info" />
                        <StatCard label="Saldo Insoluto" value={fmt(loan.outstanding_balance)} icon={TrendingDown} accent="warning" />
                        <StatCard label="Cuotas Pagadas" value={`${loan.paid_installments_count} / ${loan.installments_count}`} icon={Calendar} accent="success" />
                        <StatCard
                            label="Próx. Vencimiento"
                            value={formatDate(loan.next_due_date) || '—'}
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
                        <Collection.Root
                            collection={amortizationCollection}
                            label="Tabla de amortización"
                            actions={(row) => {
                                if (row.number === 0) {
                                    return (
                                        <Button size="sm" variant="outline" onClick={() => setShowFeeDetail(true)} title="Ver detalle">
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    )
                                }
                                if (row.status === 'PENDING' || row.status === 'OVERDUE') {
                                    return (
                                        <Button size="sm" variant="outline" onClick={() => setPayingInst(row)} title="Pagar">
                                            <DollarSign className="h-3.5 w-3.5" />
                                        </Button>
                                    )
                                }
                                if (row.status === 'PAID') {
                                    return (
                                        <Button size="sm" variant="outline" onClick={() => setViewingInst(row)} title="Ver detalle">
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    )
                                }
                                return null
                            }}
                        >
                            <Collection.View
                                table={loanInstallmentViews.table}
                                emptyTitle="Tabla aún no generada"
                                emptyDescription="Desembolsa el crédito para crearla."
                            />
                        </Collection.Root>
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
