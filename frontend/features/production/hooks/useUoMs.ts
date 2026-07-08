import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { UoM } from '../types'

export const UOMS_QUERY_KEY = ['uoms'] as const

export function useUoMs(options: { enabled?: boolean } = {}) {
  return useQuery<UoM[]>({
    queryKey: UOMS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<UoM[]>('/inventory/uoms/')
      return res.data
    },
    enabled: options.enabled ?? true,
    staleTime: 60 * 60 * 1000,
  })
}
