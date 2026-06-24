"use client"

import React, { useState } from 'react'
import { Banknote, ArrowRight, Coins, AlertTriangle } from 'lucide-react'
import {
    BaseModal, FormFooter, CancelButton, ActionSlideButton, LabeledSelect,
    MoneyDisplay, LabeledInput,
} from '@/components/shared'
import { useServerDate } from '@/hooks/useServerDate'
import { useTreasuryAccounts } from '../hooks/useTreasuryAccounts'
import { useLoanMutations } from './hooks'
import type { BankLoanCurrency, LoanInstallment } from './types'
import { parseDateOnly } from '@/lib/utils'

interface Props {
    installment: LoanInstallment
    loanCurrency: BankLoanCurrency
    penaltyRate: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LoanPayInstallmentModal({ installment, loanCurrency, penaltyRate, open, onOpenChange }: Props) {
    const { accounts } = useTreasuryAccounts()
    const { payInstallment, isPaying } = useLoanMutations()
    const { dateString, serverDate } = useServerDate()

    const [paymentAccount, setPaymentAccount] = useState('')
    const [payDate, setPayDate] = useState(dateString || new Date().toISOString().slice(0, 10))
    const [principalAmount, setPrincipalAmount] = useState(installment.principal_amount)
    const [interestAmount, setInterestAmount] = useState(installment.interest_amount)
    const [insuranceAmount, setInsuranceAmount] = useState(installment.insurance_amount)
    const [taxAmount, setTaxAmount] = useState('0')
    const [penaltyAmount, setPenaltyAmount] = useState(
        installment.status === 'OVERDUE' && parseFloat(penaltyRate || '0') > 0
            ? (() => {
                const days = Math.max(0, Math.floor(
                    ((serverDate?.getTime() ?? Date.now()) - parseDateOnly(installment.due_date).getTime()) / 86_400_000,
                ))
                return days > 0
                    ? (parseFloat(installment.total_amount) * (parseFloat(penaltyRate || '0') / 100) * (days / 30)).toFixed(2)
                    : '0'
            })()
            : '0'
    )

    const disbursementAccounts = (accounts ?? []).filter(
        (a) => a.account_type === 'CHECKING' || a.account_type === 'CASH',
    )

    const principalEdit = parseFloat(principalAmount) || 0
    const interestEdit = parseFloat(interestAmount) || 0
    const insuranceEdit = parseFloat(insuranceAmount) || 0
    const taxEdit = parseFloat(taxAmount) || 0
    const penaltyEdit = parseFloat(penaltyAmount) || 0
    const totalPayment = principalEdit + interestEdit + insuranceEdit + taxEdit + penaltyEdit

    const isUF = loanCurrency === 'UF'
    const hasUfInfo = installment.uf_value_used != null

    // Mora estimada (solo cuotas vencidas). Replica el cálculo del backend:
    // cuota_total × tasa/100 × días_atraso/30.
    const penaltyRateNum = parseFloat(penaltyRate || '0')
    const daysLate = Math.max(0, Math.floor(
        (parseDateOnly(payDate).getTime() - parseDateOnly(installment.due_date).getTime()) / 86_400_000,
    ))
    const estimatedPenalty = installment.status === 'OVERDUE' && penaltyRateNum > 0 && daysLate > 0
        ? parseFloat(installment.total_amount) * (penaltyRateNum / 100) * (daysLate / 30)
        : 0

    const handlePay = async () => {
        if (!paymentAccount) {
            window.alert('Selecciona la cuenta de pago.')
            return
        }
        await payInstallment({
            id: installment.id,
            payload: {
                payment_account: parseInt(paymentAccount),
                date: payDate,
                principal_amount: principalAmount !== installment.principal_amount ? principalAmount : undefined,
                interest_amount: interestAmount !== installment.interest_amount ? interestAmount : undefined,
                insurance_amount: insuranceAmount !== installment.insurance_amount ? insuranceAmount : undefined,
                tax_amount: taxEdit > 0 ? taxAmount : undefined,
                penalty_amount: penaltyEdit > 0 ? penaltyAmount : undefined,
            },
        })
        onOpenChange(false)
    }

    if (!open) return null

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-muted-foreground" />
                    <span>Pagar Cuota #{installment.number}</span>
                </div>
            }
            subtitle={`${installment.loan_display_id} · Vence ${installment.due_date ? parseDateOnly(installment.due_date).toLocaleDateString('es-CL') : '—'}`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                onClick={handlePay}
                                loading={isPaying}
                                disabled={isPaying || !paymentAccount}
                            >
                                Registrar Pago
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <div className="space-y-5">
                {/* Desglose editable de la cuota */}
                <div className="rounded-md border border-border p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Desglose de la cuota
                    </h3>
                    <div className="space-y-3">
                        <LabeledInput
                            label="Capital"
                            type="number"
                            value={principalAmount}
                            onChange={(e) => setPrincipalAmount(e.target.value)}
                        />
                        <LabeledInput
                            label="Interés"
                            type="number"
                            value={interestAmount}
                            onChange={(e) => setInterestAmount(e.target.value)}
                        />
                        <LabeledInput
                            label="Seguro"
                            type="number"
                            value={insuranceAmount}
                            onChange={(e) => setInsuranceAmount(e.target.value)}
                        />
                        <LabeledInput
                            label="Impuestos"
                            type="number"
                            value={taxAmount}
                            onChange={(e) => setTaxAmount(e.target.value)}
                            placeholder="0"
                        />
                        <LabeledInput
                            label="Multa por mora"
                            type="number"
                            value={penaltyAmount}
                            onChange={(e) => setPenaltyAmount(e.target.value)}
                            placeholder="0"
                        />
                        <div className="flex justify-between font-bold border-t border-border pt-2 text-sm">
                            <span>Total {isUF ? '(UF)' : ''}</span>
                            <MoneyDisplay amount={totalPayment} />
                        </div>
                    </div>
                </div>

                {/* Mora estimada (cuota vencida) */}
                {estimatedPenalty > 0 && penaltyEdit === 0 && (
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                            <AlertTriangle className="h-4 w-4" />
                            Mora por atraso ({daysLate} {daysLate === 1 ? 'día' : 'días'})
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tasa de mora</span>
                                <span>{penaltyRate}% mensual</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Mora estimada {isUF ? '(UF)' : ''}</span>
                                <MoneyDisplay amount={estimatedPenalty} />
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Estimación con prorrateo 1/30 por día; el monto definitivo se calcula al
                            registrar el pago{isUF ? ' (convertido a CLP con el valor UF del día)' : ''}.
                        </p>
                    </div>
                )}

                {/* Conversión UF → CLP */}
                {isUF && (
                    <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-info">
                            <ArrowRight className="h-4 w-4" />
                            Conversión UF → CLP
                        </div>
                        {hasUfInfo ? (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">UF usada</span>
                                    <span className="font-mono">{installment.uf_value_used}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">CLP a pagar</span>
                                    <MoneyDisplay
                                        amount={parseFloat(installment.clp_amount_paid ?? '0')}
                                        className="font-bold"
                                    />
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Se usará el valor UF vigente en la fecha de pago indicada abajo.
                                Si no hay valor cargado, la operación fallará — cárguelo en
                                Configuración &gt; Indicadores primero.
                            </p>
                        )}
                    </div>
                )}

                {/* Form */}
                <div className="space-y-3">
                    <LabeledSelect
                        label="Pagar desde cuenta"
                        required
                        placeholder="Seleccionar cuenta…"
                        options={disbursementAccounts.map((a) => ({
                            value: String(a.id), label: `${a.name} (${a.code})`,
                        }))}
                        value={paymentAccount}
                        onChange={setPaymentAccount}
                    />
                    <LabeledInput
                        label="Fecha de Pago"
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                    />
                </div>
            </div>
        </BaseModal>
    )
}
