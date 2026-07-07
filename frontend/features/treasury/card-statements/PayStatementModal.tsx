"use client"

import React, { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { BaseModal, MoneyDisplay } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useTreasuryAccounts } from '@/features/treasury'
import { useCardStatementMutations } from '../hooks/useCardStatements'
import type { CreditCardStatement } from './types'
import type { TreasuryAccount } from '@/features/treasury/types'

interface PayStatementModalProps {
    statement: CreditCardStatement | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PayStatementModal({ statement, open, onOpenChange }: PayStatementModalProps) {
    const { accounts } = useTreasuryAccounts()
    const { pay, isPaying } = useCardStatementMutations()
    const [paymentAccountId, setPaymentAccountId] = useState<number | null>(null)

    const bankAccounts = accounts.filter(
        (a: TreasuryAccount) =>
            (a.account_type === 'CHECKING' || a.account_type === 'CASH') &&
            statement?.card_account_bank != null &&
            a.bank === statement.card_account_bank,
    )

    const handlePay = async () => {
        if (!statement || !paymentAccountId) return
        await pay({ id: statement.id, payload: { payment_account: paymentAccountId } })
        onOpenChange(false)
    }

    if (!open || !statement) return null

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={`Pagar ${statement.display_id}`}
            size="sm"
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handlePay}
                        disabled={!paymentAccountId || isPaying}
                    >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {isPaying ? 'Pagando...' : 'Confirmar Pago'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Total a pagar</div>
                    <div className="text-2xl font-bold">
                        <MoneyDisplay amount={parseFloat(statement.total_to_pay)} />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium">Cuenta bancaria origen</label>
                    <select
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={paymentAccountId ?? ''}
                        onChange={(e) => setPaymentAccountId(Number(e.target.value) || null)}
                    >
                        <option value="">Seleccionar cuenta...</option>
                        {bankAccounts.map((a: TreasuryAccount) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </BaseModal>
    )
}
