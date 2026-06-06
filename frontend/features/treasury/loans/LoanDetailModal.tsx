"use client"

import React, { useState } from 'react'
import { Banknote, AlertCircle, Calendar, TrendingDown, RefreshCw } from 'lucide-react'
import {
    BaseModal, CancelButton, ActionSlideButton, LabeledSelect,
    MoneyDisplay, StatusBadge, StatCard, Skeleton, EmptyState,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useLoan, useLoanMutations } from './hooks'
import { useTreasuryAccounts } from '../hooks/useTreasuryAccounts'
import { LoanPayInstallmentModal } from './LoanPayInstallmentModal'
import type { LoanInstallment } from './types'

interface Props {
    loanId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LoanDetailModal({ loanId, open, onOpenChange }: Props) {
    const { data: loan, isLoading, isError } = useLoan(loanId)
    const { accounts } = useTreasuryAccounts()
    const { prepay, refinance, isPrepaying, isRefinancing } = useLoanMutations()

    const [payingInst, setPayingInst] = useState<LoanInstallment | null>(null)
    const [refinanceNotes, setRefinanceNotes] = useState('')
    const [showRefinance, setShowRefinance] = useState(false)
    const [prepayAccount, setPrepayAccount] = useState('')

    const disbursementAccounts = (accounts ?? []).filter(
        (a) => a.account_type === 'CHECKING' || a.account_type === 'CASH',
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
    if (isError || !loan) return (
        <BaseModal open={open} onOpenChange={onOpenChange} title="Error">
            <EmptyState
                title="No se pudo cargar el crédito"
                description="Intente nuevamente."
                icon={AlertCircle}
            />
        </BaseModal>
    )

    const handlePrepay = async () => {
        if (!prepayAccount) {
            window.alert('Selecciona la cuenta de pago.')
            return
        }
        if (window.confirm('¿Confirmas el prepago total? Esta acción paga el saldo insoluto y cierra el crédito.')) {
            await prepay({
                id: loan.id,
                payload: { payment_account: parseInt(prepayAccount) },
            })
            setPrepayAccount('')
        }
    }

    const handleRefinance = async () => {
        await refinance({ id: loan.id, payload: { notes: refinanceNotes } })
        setShowRefinance(false)
        setRefinanceNotes('')
    }

    const canPay = (inst: LoanInstallment) =>
        loan.status === 'ACTIVE' && (inst.status === 'PENDING' || inst.status === 'OVERDUE')

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
                            <span className="text-xs text-muted-foreground font-normal">
                                {loan.loan_number || 'Sin N° operación'} · {loan.amortization_system_display}
                            </span>
                        </div>
                    </div>
                }
                size="full"
            >
                <div className="space-y-6">
                    {/* Status + meta */}
                    <div className="flex items-center gap-3">
                        <StatusBadge status={loan.status} />
                        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold">
                            {loan.currency}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {loan.interest_rate}% {loan.rate_basis_display.toLowerCase()} · {loan.term_months} meses
                        </span>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard label="Capital" value={loan.principal} icon={Banknote} accent="info" />
                        <StatCard label="Saldo Insoluto" value={loan.outstanding_balance} icon={TrendingDown} accent="warning" />
                        <StatCard label="Cuotas Pagadas" value={`${loan.paid_installments_count} / ${loan.installments_count}`} icon={Calendar} accent="success" />
                        <StatCard
                            label="Próx. Vencimiento"
                            value={loan.next_due_date
                                ? new Date(loan.next_due_date).toLocaleDateString('es-CL')
                                : '—'}
                            icon={Calendar}
                            accent="info"
                        />
                    </div>

                    {/* Amortization table */}
                    <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/50">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Tabla de Amortización
                            </h3>
                        </div>
                        {loan.installments.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                Tabla aún no generada. Desembolsa el crédito para crearla.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 text-center">#</th>
                                            <th className="px-3 py-2 text-left">Vencimiento</th>
                                            <th className="px-3 py-2 text-right">Capital</th>
                                            <th className="px-3 py-2 text-right">Interés</th>
                                            <th className="px-3 py-2 text-right">Seguro</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                            <th className="px-3 py-2 text-right">Saldo</th>
                                            <th className="px-3 py-2 text-center">Estado</th>
                                            <th className="px-3 py-2 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loan.installments.map((inst) => (
                                            <tr key={inst.id} className="border-t border-border hover:bg-muted/20">
                                                <td className="px-3 py-2 text-center font-mono text-xs">
                                                    {inst.number}
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    {new Date(inst.due_date).toLocaleDateString('es-CL')}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <MoneyDisplay amount={parseFloat(inst.principal_amount)} />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <MoneyDisplay amount={parseFloat(inst.interest_amount)} />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <MoneyDisplay amount={parseFloat(inst.insurance_amount)} />
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">
                                                    <MoneyDisplay amount={parseFloat(inst.total_amount)} />
                                                </td>
                                                <td className="px-3 py-2 text-right text-muted-foreground">
                                                    <MoneyDisplay amount={parseFloat(inst.outstanding_balance)} />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <StatusBadge status={inst.status} />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {canPay(inst) ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setPayingInst(inst)}
                                                        >
                                                            Pagar
                                                        </Button>
                                                    ) : inst.uf_value_used ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            UF {inst.uf_value_used}
                                                        </span>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Lifecycle actions */}
                    {loan.status === 'ACTIVE' && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowRefinance((v) => !v)}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refinanciar
                            </Button>
                            <div className="flex items-end gap-2 ml-auto">
                                <div className="w-64">
                                    <LabeledSelect
                                        label="Prepago desde cuenta"
                                        placeholder="Seleccionar cuenta…"
                                        options={disbursementAccounts.map((a) => ({
                                            value: String(a.id), label: `${a.name} (${a.code})`,
                                        }))}
                                        value={prepayAccount}
                                        onChange={setPrepayAccount}
                                    />
                                </div>
                                <ActionSlideButton
                                    variant="destructive"
                                    onClick={handlePrepay}
                                    loading={isPrepaying}
                                    disabled={isPrepaying || !prepayAccount}
                                >
                                    Prepagar Total
                                </ActionSlideButton>
                            </div>
                        </div>
                    )}

                    {showRefinance && loan.status === 'ACTIVE' && (
                        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
                            <div className="space-y-2">
                                <Label htmlFor="refinance-notes">Notas de Refinanciación</Label>
                                <Textarea
                                    id="refinance-notes"
                                    placeholder="¿Con qué banco refinancia? Condiciones, etc."
                                    rows={3}
                                    value={refinanceNotes}
                                    onChange={(e) => setRefinanceNotes(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <CancelButton onClick={() => setShowRefinance(false)} />
                                <ActionSlideButton
                                    onClick={handleRefinance}
                                    loading={isRefinancing}
                                    disabled={isRefinancing}
                                >
                                    Confirmar Refinanciación
                                </ActionSlideButton>
                            </div>
                        </div>
                    )}

                    {loan.notes && (
                        <div className="rounded-lg border border-border p-4">
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
        </>
    )
}
