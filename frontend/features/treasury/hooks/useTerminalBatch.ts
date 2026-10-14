import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { staleTime } from '@/lib/query-config'

export function useTerminalBatch(id: number | null) {
  return useQuery({
    queryKey: id ? ['treasury', 'terminalBatch', id] : ['treasury', 'terminalBatch', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/treasury/terminal-batches/${id}/`)
      return res.data
    },
    staleTime: staleTime.standard,
    enabled: !!id,
  })
}
