import { useState, useEffect } from 'react'
import api from '@/lib/api'

export interface TreasuryAccount {
    id: number
    name: string
    code: string
    account_type: 'CASH' | 'BANK'
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    currency: string
}

export type PaymentContext = 'POS' | 'GENERAL'

export interface UseTreasuryAccountsOptions {
    /**
     * Context determines which accounts to fetch:
     * - 'POS': Fetch accounts allowed for a specific terminal
     * - 'GENERAL': Fetch all accounts with at least one payment method enabled
     */
    context: PaymentContext

    /**
     * Terminal ID (required when context is 'POS')
     */
    terminalId?: number

    /**
     * Optional payment method filter
     * When provided, only accounts that support this method are returned
     */
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER'

    /**
     * Whether to fetch immediately on mount
     */
    enabled?: boolean
}

export interface UseTreasuryAccountsReturn {
    accounts: TreasuryAccount[]
    loading: boolean
    error: string | null
    refetch: () => void
}

/**
 * Hook to fetch treasury accounts based on context (POS or GENERAL)
 * 
 * @example
 * // POS Flow: Get accounts for a specific terminal
 * const { accounts } = useTreasuryAccounts({
 *   context: 'POS',
 *   terminalId: 1,
 *   paymentMethod: 'CASH'
 * })
 * 
 * @example
 * // General Flow: Get all accounts with enabled payment methods
 * const { accounts } = useTreasuryAccounts({
 *   context: 'GENERAL',
 *   paymentMethod: 'CARD'
 * })
 */
export function useTreasuryAccounts(options: UseTreasuryAccountsOptions): UseTreasuryAccountsReturn {
    const { context, terminalId, paymentMethod, enabled = true } = options

    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchAccounts = async () => {
        if (!enabled) return

        // Validate POS context requires terminalId
        if (context === 'POS' && !terminalId) {
            setError('Terminal ID is required for POS context')
            return
        }

        try {
            setLoading(true)
            setError(null)

            let fetchedAccounts: TreasuryAccount[]

            if (context === 'POS') {
                // POS Flow: Get accounts from terminal's allowed list
                const endpoint = `/treasury/pos-terminals/${terminalId}/available_accounts/`
                const params = paymentMethod ? { payment_method: paymentMethod } : {}

                const res = await api.get(endpoint, { params })
                fetchedAccounts = res.data
            } else {
                // GENERAL Flow: Get all accounts with enabled payment methods
                const res = await api.get('/treasury/accounts/')
                const allAccounts = res.data.results || res.data

                // Filter: accounts with at least one payment method enabled
                fetchedAccounts = allAccounts.filter((acc: TreasuryAccount) =>
                    acc.allows_cash || acc.allows_card || acc.allows_transfer
                )

                // Further filter by payment method if specified
                if (paymentMethod) {
                    fetchedAccounts = fetchedAccounts.filter((acc: TreasuryAccount) => {
                        if (paymentMethod === 'CASH') return acc.allows_cash
                        if (paymentMethod === 'CARD') return acc.allows_card
                        if (paymentMethod === 'TRANSFER') return acc.allows_transfer
                        return false
                    })
                }
            }

            setAccounts(fetchedAccounts)
        } catch (err: any) {
            console.error('Error fetching treasury accounts:', err)
            setError(err.message || 'Error al cargar cuentas de tesorería')
            setAccounts([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [context, terminalId, paymentMethod, enabled])

    return {
        accounts,
        loading,
        error,
        refetch: fetchAccounts
    }
}
