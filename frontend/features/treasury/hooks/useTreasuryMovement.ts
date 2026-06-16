import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useTreasuryMovement(id: number | null) {
  return useQuery({
    queryKey: id ? ['treasury', 'movement', id] : ['treasury', 'movement', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/treasury/movements/${id}/`)
      return res.data
    },
    enabled: !!id,
  })
}
