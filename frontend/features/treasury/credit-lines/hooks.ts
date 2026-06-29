import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/features/realtime'
import { creditLinesApi } from './api'
import { CREDIT_LINES_KEYS } from '../hooks/queryKeys'
import type { CreditLineCreatePayload } from './types'

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
    const qc = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const create = useMutation({
        mutationFn: (data: CreditLineCreatePayload) => creditLinesApi.create(data),
        onSuccess: () => {
            markLocalMutation()
            qc.invalidateQueries({ queryKey: CREDIT_LINES_KEYS.all })
        },
    })

    const update = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CreditLineCreatePayload> }) =>
            creditLinesApi.update(id, data),
        onSuccess: () => {
            markLocalMutation()
            qc.invalidateQueries({ queryKey: CREDIT_LINES_KEYS.all })
        },
    })

    const remove = useMutation({
        mutationFn: (id: number) => creditLinesApi.delete(id),
        onSuccess: () => {
            markLocalMutation()
            qc.invalidateQueries({ queryKey: CREDIT_LINES_KEYS.all })
        },
    })

    return { create, update, remove }
}
