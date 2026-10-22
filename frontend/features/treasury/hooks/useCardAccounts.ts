"use client"

import { useMemo } from 'react'
import { useBankOverview } from './useBankOverview'
import type { BankOverviewData } from './useBankOverview'
import { useTreasuryAccounts } from './useTreasuryAccounts'

export interface CardAccountOption {
    id: number
    name: string
    currency: string
}

/**
 * Cuentas de tarjeta de crédito para los selectores del hub de TC.
 *
 * - Con `bankId`: sólo las tarjetas de ese banco (vía overview del banco).
 * - Sin `bankId`: todas las tarjetas (vista agregada de Centro de Bancos).
 */
export function useCardAccounts(bankId?: number): {
    cardAccounts: CardAccountOption[]
    isLoading: boolean
} {
    const { data: overview, isLoading: overviewLoading } = useBankOverview(bankId ?? null)
    const { accounts, isLoading: accountsLoading } = useTreasuryAccounts({
        filters: { account_type: 'CREDIT_CARD' },
        enabled: !bankId,
    })

    const cardAccounts = useMemo(() => {
        const source = bankId
            ? ((overview as BankOverviewData | undefined)?.accounts ?? [])
            : (accounts ?? [])
        return source
            .filter((a) => a.account_type === 'CREDIT_CARD')
            .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))
    }, [bankId, overview, accounts])

    return {
        cardAccounts,
        isLoading: bankId ? overviewLoading : accountsLoading,
    }
}
