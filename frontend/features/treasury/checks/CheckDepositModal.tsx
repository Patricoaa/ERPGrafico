"use client"

import React, { useState } from 'react'
import { BaseModal, FormFooter, CancelButton, ActionSlideButton, LabeledSelect } from '@/components/shared'
import { formatMoney } from '@/lib/money'
import { TreasuryAccountSelector } from '@/components/selectors/TreasuryAccountSelector'
import { useCheckMutations } from '../hooks/useChecks'
import type { Check } from './types'

interface Props {
    check: Check
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CheckDepositModal({ check, open, onOpenChange }: Props) {
    const { deposit } = useCheckMutations()
    const [accountId, setAccountId] = useState('')
    const [saving, setSaving] = useState(false)

    const handleDeposit = async () => {
        if (!accountId) return
        setSaving(true)
        try {
            await deposit({ id: check.id, payload: { deposit_account: parseInt(accountId) } })
            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title={`Depositar ${check.display_id}`}
            description={`Cheque N° ${check.check_number} — ${formatMoney(parseFloat(check.amount))}`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                loading={saving}
                                disabled={saving || !accountId}
                                onClick={handleDeposit}
                            >
                                Confirmar Depósito
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <div className="px-1 py-2">
                <TreasuryAccountSelector
                    label="Cuenta Bancaria de Depósito"
                    value={accountId}
                    onChange={(v) => setAccountId(v ?? '')}
                    type="CHECKING"
                />
            </div>
        </BaseModal>
    )
}
