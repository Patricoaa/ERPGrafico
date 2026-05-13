import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface TreasuryAccount {
    id: number
    name: string
    code: string
    account_type: 'CASH' | 'BANK'
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    allows_check: boolean
    currency: string
    current_balance?: number
}

export type PaymentContext = 'POS' | 'GENERAL'

export interface UseTreasuryAccountsOptions {
    context: PaymentContext
    terminalId?: number
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK'
    enabled?: boolean
    excludeId?: number
}

export const TREASURY_ACCOUNT_KEYS = {
    all: ['treasury_accounts'] as const,
    list: (opts: UseTreasuryAccountsOptions) => [...TREASURY_ACCOUNT_KEYS.all, 'list', opts] as const,
}

export function useTreasuryAccounts(options: UseTreasuryAccountsOptions) {
    const { context, terminalId, paymentMethod, enabled = true, excludeId } = options

    const isValid = context === 'GENERAL' || (context === 'POS' && !!terminalId)

    const query = useQuery({
        queryKey: TREASURY_ACCOUNT_KEYS.list({ context, terminalId, paymentMethod, excludeId }),
        queryFn: async ({ signal }) => {
            let fetchedAccounts: TreasuryAccount[]

            if (context === 'POS') {
                const endpoint = `/treasury/pos-terminals/${terminalId}/available_accounts/`
                const params: any = paymentMethod ? { payment_method: paymentMethod } : {}
                if (excludeId) params.exclude_id = excludeId

                const res = await api.get(endpoint, { params, signal })
                fetchedAccounts = res.data
            } else {
                const params: any = {}
                if (excludeId) params.exclude_id = excludeId

                const res = await api.get('/treasury/accounts/', { params, signal })
                const allAccounts = res.data.results || res.data

                fetchedAccounts = allAccounts.filter((acc: TreasuryAccount & { allows_check: boolean }) =>
                    acc.allows_cash || acc.allows_card || acc.allows_transfer || acc.allows_check
                )

                if (paymentMethod) {
                    fetchedAccounts = fetchedAccounts.filter((acc: TreasuryAccount & { allows_check: boolean }) => {
                        if (paymentMethod === 'CASH') return acc.allows_cash
                        if (paymentMethod === 'CARD') return acc.allows_card
                        if (paymentMethod === 'TRANSFER') return acc.allows_transfer
                        if (paymentMethod === 'CHECK') return acc.allows_check
                        return false
                    })
                }
            }

            return fetchedAccounts
        },
        enabled: enabled && isValid,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        accounts: query.data ?? [],
        loading: query.isLoading,
        error: query.error ? (query.error as any).message || 'Error al cargar cuentas de tesorería' : null,
        refetch: query.refetch,
    }
}
