"use client"

import React, { useState } from 'react'
import { Banknote, ArrowRight, Coins, AlertTriangle } from 'lucide-react'
import {
    BaseModal, FormFooter, CancelButton, ActionSlideButton, LabeledSelect,
    MoneyDisplay, LabeledInput,
} from '@/components/shared'
import { useTreasuryAccounts } from '../hooks/useTreasuryAccounts'
import { useLoanMutations } from './hooks'
import type { BankLoanCurrency, LoanInstallment } from './types'

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

    const [paymentAccount, setPaymentAccount] = useState('')
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))

    const disbursementAccounts = (accounts ?? []).filter(
        (a) => a.account_type === 'CHECKING' || a.account_type === 'CASH',
    )

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
            },
        })
        onOpenChange(false)
    }

    if (!open) return null

    const isUF = loanCurrency === 'UF'
    const hasUfInfo = installment.uf_value_used != null

    // Mora estimada (solo cuotas vencidas). Replica el cálculo del backend:
    // cuota_total × tasa/100 × días_atraso/30. El monto definitivo se calcula
    // al registrar el pago (y, en UF, se convierte a CLP con el valor del día).
    const penaltyRateNum = parseFloat(penaltyRate || '0')
    const daysLate = Math.max(0, Math.floor(
        (new Date(payDate).getTime() - new Date(installment.due_date).getTime()) / 86_400_000,
    ))
    const estimatedPenalty = installment.status === 'OVERDUE' && penaltyRateNum > 0 && daysLate > 0
        ? parseFloat(installment.total_amount) * (penaltyRateNum / 100) * (daysLate / 30)
        : 0
    const totalWithPenalty = parseFloat(installment.total_amount) + estimatedPenalty

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
            subtitle={`${installment.loan_display_id} · Vence ${new Date(installment.due_date).toLocaleDateString('es-CL')}`}
        >
            <div className="space-y-5">
                {/* Desglose de la cuota */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Desglose de la cuota
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Capital</span>
                            <MoneyDisplay amount={parseFloat(installment.principal_amount)} />
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Interés</span>
                            <MoneyDisplay amount={parseFloat(installment.interest_amount)} />
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Seguro</span>
                            <MoneyDisplay amount={parseFloat(installment.insurance_amount)} />
                        </div>
                        <div className="flex justify-between font-bold border-t border-border pt-2">
                            <span>Total {isUF ? '(UF)' : ''}</span>
                            <MoneyDisplay amount={parseFloat(installment.total_amount)} />
                        </div>
                    </div>
                </div>

                {/* Mora estimada (cuota vencida) */}
                {estimatedPenalty > 0 && (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-2">
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
                            <div className="col-span-2 flex justify-between font-bold border-t border-border pt-2">
                                <span>Total con mora {isUF ? '(UF)' : ''}</span>
                                <MoneyDisplay amount={totalWithPenalty} />
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
                    <div className="rounded-lg border border-info/30 bg-info/5 p-4 space-y-2">
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
                        options={[
                            { value: '', label: 'Seleccionar…' },
                            ...disbursementAccounts.map((a) => ({
                                value: String(a.id), label: `${a.name} (${a.code})`,
                            })),
                        ]}
                        value={paymentAccount}
                        onChange={setPaymentAccount}
                    />
                    <LabeledInput
                        label="Fecha de Pago"
                        type="date"
                        value={payDate}
                        onChange={(v) => setPayDate(String(v))}
                    />
                </div>
            </div>

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
        </BaseModal>
    )
}
