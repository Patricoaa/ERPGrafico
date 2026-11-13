"use client"

import React from 'react'
import { FileText, Coins, Calendar } from 'lucide-react'
import {
    BaseModal, FormFooter, CancelButton, MoneyDisplay, StatusBadge,
    Section,
} from '@/components/shared'
import type { LoanInstallment, BankLoanCurrency } from './types'
import { formatPlainDate } from '@/lib/utils'

interface Props {
    installment: LoanInstallment
    loanDisplayId: string
    loanCurrency: BankLoanCurrency
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LoanInstallmentReadonlyModal({ installment, loanDisplayId, loanCurrency, open, onOpenChange }: Props) {
    if (!open) return null

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span>Cuota #{installment.number} · {installment.status_display}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                            {loanDisplayId} · Vence {installment.due_date ? formatPlainDate(installment.due_date) : '—'}
                        </span>
                    </div>
                </div>
            }
            footer={
                <FormFooter
                    actions={<CancelButton onClick={() => onOpenChange(false)} />}
                />
            }
        >
            <div className="space-y-4">
                <Section title="Montos Pagados" icon={Coins}>
                    <Section.Row variant="stat" title="Capital" value={<MoneyDisplay amount={parseFloat(installment.principal_amount)} />} />
                    <Section.Row variant="stat" title="Interés" value={<MoneyDisplay amount={parseFloat(installment.interest_amount)} />} />
                    <Section.Row variant="stat" title="Seguro" value={<MoneyDisplay amount={parseFloat(installment.insurance_amount)} />} />
                    {parseFloat(installment.penalty_paid) > 0 && (
                        <Section.Row variant="stat" title="Multa por mora" value={<MoneyDisplay amount={parseFloat(installment.penalty_paid)} />} />
                    )}
                    <Section.Row variant="stat" strong title={`Total ${loanCurrency === 'UF' ? '(UF)' : ''}`} value={<MoneyDisplay amount={parseFloat(installment.total_amount)} />} />
                </Section>

                {installment.paid_at && (
                    <Section title="Información del Pago" icon={Calendar}>
                        <Section.Row variant="stat" plain title="Fecha de pago" value={formatPlainDate(installment.paid_at)} />
                        {installment.uf_value_used && (
                            <Section.Row variant="stat" title="UF utilizada" value={installment.uf_value_used} />
                        )}
                        {installment.clp_amount_paid && (
                            <Section.Row variant="stat" title="Total CLP" value={<MoneyDisplay amount={parseFloat(installment.clp_amount_paid)} />} />
                        )}
                        {installment.payment_movement && (
                            <Section.Row variant="stat" title="Movimiento" value={`#${installment.payment_movement}`} />
                        )}
                        <Section.Row variant="stat" plain title="Estado" value={<StatusBadge status={installment.status} variant="badge" />} />
                    </Section>
                )}

                {installment.notes && (
                    <div>
                        <Section.Header title="Notas" className="mb-2" />
                        <p className="text-sm whitespace-pre-wrap">{installment.notes}</p>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
