import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { treasuryApi } from '../api/treasuryApi'
import { BATCHES_KEYS } from './queryKeys'
import type { FilterState } from '@/components/shared'
import type { TerminalBatchCreatePayload } from '../types'

export { BATCHES_KEYS }

export function useTerminalBatches(filters?: FilterState) {
    const queryClient = useQueryClient()

    const params: Record<string, string> = {}
    if (filters?.status) params.status = filters.status
    if (filters?.date_from) params.date_from = filters.date_from
    if (filters?.date_to) params.date_to = filters.date_to

    const { data: batches, isLoading, refetch } = useQuery({
        queryKey: [...BATCHES_KEYS.list(), filters],
        queryFn: () => treasuryApi.getTerminalBatches(Object.keys(params).length > 0 ? params : undefined),
        staleTime: 2 * 60 * 1000,
    })

    const createBatch = useMutation({
        mutationFn: (payload: TerminalBatchCreatePayload) => treasuryApi.createTerminalBatch(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BATCHES_KEYS.all })
            toast.success('Liquidación registrada exitosamente')
        },
        onError: (err) => showApiError(err, 'Error al registrar liquidación'),
    })

    return {
        batches: batches ?? [],
        isLoading,
        refetch,
        createBatch: createBatch.mutateAsync,
        isCreating: createBatch.isPending,
    }
}
