"use client"

import React, { useState, useMemo } from 'react'
import { Banknote, ArrowRight, Coins, Calculator } from 'lucide-react'
import { BaseModal, FormFooter, CancelButton, DangerButton, MoneyDisplay, LabeledInput, Section } from "@/components/shared"
import { TreasuryAccountSelector } from '@/components/selectors/TreasuryAccountSelector'
import { useServerDate } from '@/hooks/useServerDate'
import { useLoanMutations } from '../hooks/useLoans'
import type { BankLoan } from './types'

interface Props {
    loan: BankLoan
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PrepayLoanModal({ loan, open, onOpenChange }: Props) {
    const { prepay, isPrepaying } = useLoanMutations()
    const { dateString } = useServerDate()

    const [paymentAccount, setPaymentAccount] = useState('')
    const [payDate, setPayDate] = useState(dateString || new Date().toISOString().slice(0, 10))
    const [insuranceAmount, setInsuranceAmount] = useState('0')
    const [taxAmount, setTaxAmount] = useState('0')
    const [penaltyAmount, setPenaltyAmount] = useState('0')

    const pendingInstallments = useMemo(() =>
        loan.installments.filter((inst) =>
            inst.status === 'PENDING' || inst.status === 'OVERDUE' || inst.status === 'PARTIAL'
        ),
        [loan.installments],
    )

    const totalPrincipal = useMemo(() =>
        pendingInstallments.reduce((sum, inst) => sum + parseFloat(inst.principal_amount), 0),
        [pendingInstallments],
    )

    const totalInterest = useMemo(() =>
        pendingInstallments.reduce((sum, inst) => sum + parseFloat(inst.interest_amount), 0),
        [pendingInstallments],
    )

    const insuranceEdit = parseFloat(insuranceAmount) || 0
    const taxEdit = parseFloat(taxAmount) || 0
    const penaltyEdit = parseFloat(penaltyAmount) || 0
    const totalWithPenalty = totalPrincipal + totalInterest + insuranceEdit + taxEdit + penaltyEdit

    const isUF = loan.currency === 'UF'

    const handlePrepay = async () => {
        if (!paymentAccount) return
        await prepay({
            id: loan.id,
            payload: {
                payment_account: parseInt(paymentAccount),
                date: payDate,
                insurance_amount: insuranceEdit > 0 ? insuranceAmount : undefined,
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
                    <span>Prepago Total</span>
                </div>
            }
            subtitle={`${loan.display_id} · Saldo insoluto de ${pendingInstallments.length} cuota(s)`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <DangerButton
                                variant="destructive"
                                onClick={handlePrepay}
                                loading={isPrepaying}
                                disabled={isPrepaying || !paymentAccount}
                            >
                                Confirmar Prepago Total
                            </DangerButton>
                        </>
                    }
                />
            }
        >
            <div className="space-y-5">
                <div className="space-y-2">
                    <Section title="Saldo Insoluto" icon={Coins}>
                        <Section.Row variant="stat" title="Capital total" value={<MoneyDisplay amount={totalPrincipal} />} />
                        <Section.Row variant="stat" title="Interés total" value={<MoneyDisplay amount={totalInterest} />} />
                        <Section.Row variant="stat" strong title={`Total ${isUF ? '(UF)' : ''}`} value={<MoneyDisplay amount={totalPrincipal + totalInterest} />} />
                    </Section>
                    <p className="text-2xs text-muted-foreground">
                        Capital e interés se pagan completos (no editables).
                    </p>
                </div>

                <Section title="Desglose del Pago" icon={Calculator}>
                    <Section.Row variant="stat" title="Capital" value={<MoneyDisplay amount={totalPrincipal} />} />
                    <Section.Row variant="stat" title="Interés" value={<MoneyDisplay amount={totalInterest} />} />
                    <Section.Row control={<LabeledInput label="Seguro (editable)" type="number" value={insuranceAmount} onChange={(e) => setInsuranceAmount(e.target.value)} placeholder="0" />} />
                    <Section.Row control={<LabeledInput label="Impuestos (editable)" type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0" />} />
                    <Section.Row control={<LabeledInput label="Multa por mora (editable)" type="number" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} placeholder="0" />} />
                    <Section.Row variant="stat" strong title={`Total a pagar ${isUF ? '(UF)' : ''}`} value={<MoneyDisplay amount={totalWithPenalty} />} />
                </Section>

                {isUF && (
                    <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-info">
                            <ArrowRight className="h-4 w-4" />
                            Conversión UF → CLP
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Se usará el valor UF vigente en la fecha de pago indicada abajo.
                            Si no hay valor cargado, la operación fallará — cárguelo en
                            Configuración &gt; Indicadores primero.
                        </p>
                    </div>
                )}

                <div className="space-y-3">
                    <TreasuryAccountSelector
                        label="Pagar desde cuenta"
                        required
                        value={paymentAccount}
                        onChange={(v) => setPaymentAccount(v ?? '')}
                        accountTypes={['CHECKING', 'CASH']}
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
