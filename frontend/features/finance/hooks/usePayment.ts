import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { FINANCE_KEYS } from './queryKeys'

export function usePayment(id: number | null) {
  return useQuery({
    queryKey: id ? [...FINANCE_KEYS.all, 'payment', id] : [...FINANCE_KEYS.all, 'payment', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/treasury/payments/${id}/`)
      return res.data
    },
    enabled: !!id,
  })
}
