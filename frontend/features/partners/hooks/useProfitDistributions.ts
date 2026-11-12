'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi, type ProfitDistribution } from '@/features/contacts'
import { staleTime } from '@/lib/query-config'
import { PARTNER_KEYS } from './queryKeys'

export function useProfitDistributions() {
    const query = useQuery<ProfitDistribution[]>({
        queryKey: PARTNER_KEYS.distributions(),
        queryFn: () => partnersApi.getProfitDistributions(),
        staleTime: staleTime.standard,
    })
    return {
        distributions: query.data ?? [],
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
    }
}
