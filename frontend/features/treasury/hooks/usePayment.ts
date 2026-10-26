import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PAYMENTS_KEYS } from './queryKeys'
import type { PaymentDetail } from '../types'
import { staleTime } from '@/lib/query-config'

export function usePayment(id: number | null) {
  return useQuery({
    queryKey: id ? PAYMENTS_KEYS.detail(id) : [...PAYMENTS_KEYS.all, 'noop'],
    queryFn: async () => {
      const res = await api.get<PaymentDetail>(`/treasury/payments/${id}/`)
      return res.data
    },
    staleTime: staleTime.standard,
    enabled: !!id,
  })
}
