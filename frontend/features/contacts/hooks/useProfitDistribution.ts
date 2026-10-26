import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PARTNERS_KEYS } from './usePartners'
import type { ProfitDistribution } from '../types/partner'
import { staleTime } from '@/lib/query-config'

export function useProfitDistribution(id: number | null) {
  const { data: profitDistribution, isLoading, isError } = useQuery({
    queryKey: id ? [...PARTNERS_KEYS.all, 'distribution', id] : [...PARTNERS_KEYS.all, 'distribution', 'noop'],
    queryFn: async () => {
      const res = await api.get<ProfitDistribution>(`/contacts/profit-distributions/${id}/`)
      return res.data
    },
    staleTime: staleTime.standard,
    enabled: !!id,
  })
  return { profitDistribution: profitDistribution ?? null, isLoading, isError }
}
