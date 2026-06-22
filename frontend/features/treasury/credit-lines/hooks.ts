import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { creditLinesApi } from './api'
import { CREDIT_LINES_KEYS } from '@/features/treasury/hooks/queryKeys'
import type { CreditLineCreatePayload } from './types'

export function useCreditLines(params?: { bank_id?: number; status?: string }) {
    return useQuery({
        queryKey: [...CREDIT_LINES_KEYS.lists(), params],
        queryFn: () => creditLinesApi.list(params),
    })
}

export function useCreditLine(id: number | null) {
    return useQuery({
        queryKey: CREDIT_LINES_KEYS.detail(id!),
        queryFn: () => creditLinesApi.get(id!),
        enabled: !!id,
    })
}

export function useCreditLineOverview(id: number | null) {
    return useQuery({
        queryKey: [...CREDIT_LINES_KEYS.detail(id!), 'overview'],
        queryFn: () => creditLinesApi.overview(id!),
        enabled: !!id,
    })
}

export function useCreditLineMutations() {
    const qc = useQueryClient()

    const create = useMutation({
        mutationFn: (data: CreditLineCreatePayload) => creditLinesApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CREDIT_LINES_KEYS.all })
        },
    })

    const update = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CreditLineCreatePayload> }) =>
            creditLinesApi.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CREDIT_LINES_KEYS.all })
        },
    })

    const remove = useMutation({
        mutationFn: (id: number) => creditLinesApi.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CREDIT_LINES_KEYS.all })
        },
    })

    return { create, update, remove }
}
