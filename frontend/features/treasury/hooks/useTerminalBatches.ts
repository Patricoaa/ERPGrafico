import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { toast } from 'sonner'
import { TREASURY_MOVEMENTS_QUERY_KEY } from './useTreasuryMovements'

import { BATCHES_KEYS } from './queryKeys'

export { BATCHES_KEYS }

export function useTerminalBatches() {
    const queryClient = useQueryClient()

    const { data: batches, isLoading, refetch } = useQuery({
        queryKey: BATCHES_KEYS.list(),
        queryFn: treasuryApi.getTerminalBatches,
        staleTime: 2 * 60 * 1000, // 2 min
    })

    return {
        batches: batches ?? [],
        isLoading,
        refetch,
    }
}
