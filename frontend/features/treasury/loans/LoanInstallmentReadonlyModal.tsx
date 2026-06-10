"use client"

import React from 'react'
import { FileText, Coins, Calendar } from 'lucide-react'
import {
    BaseModal, FormFooter, CancelButton, MoneyDisplay, StatusBadge,
} from '@/components/shared'
import type { LoanInstallment, BankLoanCurrency } from './types'

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
                            {loanDisplayId} · Vence {new Date(installment.due_date).toLocaleDateString('es-CL')}
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
                {/* Montos pagados */}
                <div className="rounded-lg border border-border p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Montos Pagados
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
                        {parseFloat(installment.penalty_paid) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Multa por mora</span>
                                <MoneyDisplay amount={parseFloat(installment.penalty_paid)} />
                            </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-border pt-2 col-span-2">
                            <span>Total {loanCurrency === 'UF' ? '(UF)' : ''}</span>
                            <MoneyDisplay amount={parseFloat(installment.total_amount)} />
                        </div>
                    </div>
                </div>

                {/* Información del pago */}
                {installment.paid_at && (
                    <div className="rounded-lg border border-border p-4 space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Información del Pago
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Fecha de pago</span>
                                <span>{new Date(installment.paid_at).toLocaleDateString('es-CL')}</span>
                            </div>
                            {installment.uf_value_used && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">UF utilizada</span>
                                    <span className="font-mono">{installment.uf_value_used}</span>
                                </div>
                            )}
                            {installment.clp_amount_paid && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total CLP</span>
                                    <MoneyDisplay amount={parseFloat(installment.clp_amount_paid)} />
                                </div>
                            )}
                            {installment.payment_movement && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Movimiento</span>
                                    <span className="font-mono">#{installment.payment_movement}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Estado</span>
                                <StatusBadge status={installment.status} />
                            </div>
                        </div>
                    </div>
                )}

                {installment.notes && (
                    <div className="rounded-lg border border-border p-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</h4>
                        <p className="text-sm whitespace-pre-wrap">{installment.notes}</p>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
