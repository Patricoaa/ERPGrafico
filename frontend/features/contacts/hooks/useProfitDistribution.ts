import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PARTNERS_KEYS } from './usePartners'

export function useProfitDistribution(id: number | null) {
  const { data: profitDistribution, isLoading, isError } = useQuery({
    queryKey: id ? [...PARTNERS_KEYS.all, 'distribution', id] : [...PARTNERS_KEYS.all, 'distribution', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/contacts/profit-distributions/${id}/`)
      return res.data
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
  return { profitDistribution: profitDistribution ?? null, isLoading, isError }
}
