import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FilterState } from '@/components/shared'

import { BATCHES_KEYS } from './queryKeys'

export { BATCHES_KEYS }

export function useTerminalBatches(filters?: FilterState) {
    const { data: batches, isLoading, refetch } = useQuery({
        queryKey: [...BATCHES_KEYS.list(), filters],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.status) params.append('status', filters.status)
            if (filters?.date_from) params.append('date_from', filters.date_from)
            if (filters?.date_to) params.append('date_to', filters.date_to)
            const response = await api.get('/treasury/terminal-batches/', { params })
            return response.data.results || response.data
        },
        staleTime: 2 * 60 * 1000, // 2 min
    })

    return {
        batches: batches ?? [],
        isLoading,
        refetch,
    }
}
