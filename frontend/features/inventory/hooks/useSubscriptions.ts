import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useRealtime } from '@/features/realtime'
import { PRODUCTS_KEYS } from './queryKeys'
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
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: subscriptions, isLoading, refetch } = useQuery({
        queryKey: [...SUBSCRIPTIONS_QUERY_KEY, filters],
        queryFn: async (): Promise<Subscription[]> => {
            const params = new URLSearchParams()
            if (filters?.status) params.append('status', filters.status)
            if (filters?.search) params.append('search', filters.search)
            const response = await api.get<Subscription[]>('/inventory/subscriptions/', { params })
            return response.data
        },
        staleTime: 2 * 60 * 1000,
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY })
        // pause/resume cambian el status del producto-suscripción → invalida products.
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.all })
    }

    const pauseMutation = useMutation({
        mutationFn: async (id: number) => api.post(`/inventory/subscriptions/${id}/pause/`),
        onSuccess: () => { markLocalMutation(); invalidate() },
    })

    const resumeMutation = useMutation({
        mutationFn: async (id: number) => api.post(`/inventory/subscriptions/${id}/resume/`),
        onSuccess: () => { markLocalMutation(); invalidate() },
    })

    return {
        subscriptions: subscriptions ?? [],
        isLoading,
        refetch,
        pauseSubscription: pauseMutation.mutateAsync,
        resumeSubscription: resumeMutation.mutateAsync,
    }
}

export interface SubscriptionStats {
    [key: string]: unknown
}

/**
 * Stats agregadas de subscriptions (counts por status, MRR, etc.).
 * Forma exacta consumida localmente por SubscriptionsView; tipo genérico
 * para no acoplar.
 */
export function useSubscriptionStats<T = SubscriptionStats>() {
    return useQuery<T>({
        queryKey: [...SUBSCRIPTIONS_QUERY_KEY, 'stats'],
        queryFn: async () => {
            const response = await api.get<T>('/inventory/subscriptions/stats/')
            return response.data
        },
        staleTime: 5 * 60 * 1000,
    })
}

/**
 * Historial completo de una suscripción (price_history, payment_history, etc.).
 * Forma local del SubscriptionHistoryModal; tipo genérico.
 */
export function useSubscriptionHistory<T = unknown>(subscriptionId: number | null | undefined) {
    return useQuery<T | null>({
        queryKey: subscriptionId
            ? [...SUBSCRIPTIONS_QUERY_KEY, 'history', subscriptionId]
            : [...SUBSCRIPTIONS_QUERY_KEY, 'history', 'noop'],
        queryFn: async () => {
            if (!subscriptionId) return null
            const response = await api.get<T>(`/inventory/subscriptions/${subscriptionId}/history/`)
            return response.data
        },
        enabled: !!subscriptionId,
    })
}
