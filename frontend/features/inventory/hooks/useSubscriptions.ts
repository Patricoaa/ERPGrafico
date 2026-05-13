import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FilterState } from '@/components/shared'

export interface Subscription {
    id: number
    product: number
    product_name: string
    product_code: string
    product_internal_code?: string
    category_name?: string
    supplier_name: string
    supplier_id: number
    start_date: string
    end_date: string | null
    next_payment_date: string
    amount: string
    currency: string
    status: string
    status_display: string
    recurrence_period: string
    recurrence_display: string
    payment_day_type: string | null
    payment_day: number | null
    payment_interval_days: number | null
    notes: string
}

export const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions']

export function useSubscriptions(filters?: FilterState) {
    const { data: subscriptions, isLoading, refetch } = useQuery({
        queryKey: [...SUBSCRIPTIONS_QUERY_KEY, filters],
        queryFn: async (): Promise<Subscription[]> => {
            const params = new URLSearchParams()
            if (filters?.status) params.append('status', filters.status)
            if (filters?.search) params.append('search', filters.search)
            const response = await api.get('/inventory/subscriptions/', { params })
            return response.data.results || response.data
        },
        staleTime: 2 * 60 * 1000,
    })

    return {
        subscriptions: subscriptions ?? [],
        isLoading,
        refetch,
    }
}
