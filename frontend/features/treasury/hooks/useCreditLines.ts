import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { creditLinesApi } from '../credit-lines/api'
import { CREDIT_LINES_KEYS } from './queryKeys'
import type { CreditLineCreatePayload } from '../credit-lines/types'

export function useCreditLines(params?: { treasury_account_id?: number; bank_id?: number; status?: string }) {
    return useQuery({
        queryKey: [...CREDIT_LINES_KEYS.lists(), params],
        queryFn: () => creditLinesApi.list(params),
        staleTime: 2 * 60 * 1000,
    })
}

export function useCreditLine(id: number | null) {
    return useQuery({
        queryKey: CREDIT_LINES_KEYS.detail(id as number),
        queryFn: () => creditLinesApi.get(id as number),
        staleTime: 2 * 60 * 1000,
        enabled: !!id,
    })
}

export function useCreditLineOverview(id: number | null) {
    return useQuery({
        queryKey: [...CREDIT_LINES_KEYS.detail(id as number), 'overview'],
        queryFn: () => creditLinesApi.overview(id as number),
        staleTime: 2 * 60 * 1000,
        enabled: !!id,
    })
}

export function useCreditLineMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => invalidateCrossFeature(queryClient, [CREDIT_LINES_KEYS.all])

    const create = useMutation({
        mutationFn: (data: CreditLineCreatePayload) => creditLinesApi.create(data),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    const update = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CreditLineCreatePayload> }) =>
            creditLinesApi.update(id, data),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    const remove = useMutation({
        mutationFn: (id: number) => creditLinesApi.delete(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    return { create, update, remove }
}
