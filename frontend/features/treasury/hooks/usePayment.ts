import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PAYMENTS_KEYS } from './queryKeys'

export function usePayment(id: number | null) {
  return useQuery({
    queryKey: id ? PAYMENTS_KEYS.detail(id) : [...PAYMENTS_KEYS.all, 'noop'],
    queryFn: async () => {
      const res = await api.get(`/treasury/payments/${id}/`)
      return res.data
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}
