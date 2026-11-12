'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi } from '@/features/contacts'
import { staleTime } from '@/lib/query-config'
import { PARTNER_KEYS } from './queryKeys'

export function useProfitDistribution(id: number | null) {
  const { data, isLoading, isError } = useQuery({
    queryKey: PARTNER_KEYS.distribution(id ?? 0),
    queryFn: () => partnersApi.getProfitDistribution(id ?? 0),
    staleTime: staleTime.standard,
    enabled: !!id,
  })
  return { profitDistribution: data ?? null, isLoading, isError }
}
