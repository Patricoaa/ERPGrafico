import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { toast } from 'sonner'

const BATCHES_KEYS = {
    all: ['terminal-batches'] as const,
    list: () => [...BATCHES_KEYS.all, 'list'] as const,
}

export function useTerminalBatches() {
    const queryClient = useQueryClient()

    const { data: batches, isLoading, refetch } = useQuery({
        queryKey: BATCHES_KEYS.list(),
        queryFn: treasuryApi.getTerminalBatches,
    })

    return {
        batches: batches ?? [],
        isLoading,
        refetch,
    }
}
