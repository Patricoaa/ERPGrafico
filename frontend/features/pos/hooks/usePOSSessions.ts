import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FilterState } from '@/components/shared'

export interface POSSession {
    id: number
    id_display: string
    user_name: string
    treasury_account: number
    treasury_account_name: string
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    start_amount: number
    current_cash?: number
    expected_cash: number
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

export const POS_SESSIONS_QUERY_KEY = ['posSessions']

export function usePOSSessions(filters?: FilterState) {
    const { data: sessions, isLoading, refetch } = useQuery({
        queryKey: [...POS_SESSIONS_QUERY_KEY, filters],
        queryFn: async (): Promise<POSSession[]> => {
            const params = new URLSearchParams()
            if (filters?.status) params.append('status', filters.status)
            if (filters?.search) params.append('search', filters.search)
            const response = await api.get('/treasury/pos-sessions/', { params })
            return response.data
        },
        staleTime: 60 * 1000, // 1 min — datos operativos activos
    })

    return {
        sessions: sessions ?? [],
        isLoading,
        refetch,
    }
}
