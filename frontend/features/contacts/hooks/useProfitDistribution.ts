import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PARTNERS_KEYS } from './usePartners'

export function useProfitDistribution(id: number | null) {
  return useQuery({
    queryKey: id ? [...PARTNERS_KEYS.all, 'distribution', id] : [...PARTNERS_KEYS.all, 'distribution', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/contacts/profit-distributions/${id}/`)
      return res.data
    },
    enabled: !!id,
  })
}
