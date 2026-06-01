"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useRealtime } from '@/features/realtime'
import { PRICING_RULES_QUERY_KEY, PRODUCTS_QUERY_KEY } from './queryKeys'

export function usePricingRuleMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PRICING_RULES_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
    }

    const deletePricingRule = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/pricing-rules/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    const savePricingRule = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Record<string, unknown> }) => {
            const res = id !== null
                ? await api.put<Record<string, unknown>>(`/inventory/pricing-rules/${id}/`, payload)
                : await api.post<Record<string, unknown>>('/inventory/pricing-rules/', payload)
            return res.data
        },
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    return {
        deletePricingRule: deletePricingRule.mutateAsync,
        isDeleting: deletePricingRule.isPending,
        savePricingRule: savePricingRule.mutateAsync,
        isSaving: savePricingRule.isPending,
    }
}
