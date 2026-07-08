import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PURCHASING_KEYS } from './queryKeys'

export function usePurchaseOrderDetail(id: number | null) {
  return useQuery({
    queryKey: id ? [...PURCHASING_KEYS.all, 'detail', id] : [...PURCHASING_KEYS.all, 'detail', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/purchasing/orders/${id}/`)
      return res.data as Record<string, unknown>
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}
