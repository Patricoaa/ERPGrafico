import { useQueryClient, useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { toast } from 'sonner'

const BATCHES_KEYS = {
    all: ['terminal-batches'] as const,
    list: () => [...BATCHES_KEYS.all, 'list'] as const,
}

export function useTerminalBatches() {
    const queryClient = useQueryClient()

    const { data: batches, refetch } = useSuspenseQuery({
        queryKey: BATCHES_KEYS.list(),
        queryFn: treasuryApi.getTerminalBatches,
    })

    return {
        batches,
        refetch
    }
}
