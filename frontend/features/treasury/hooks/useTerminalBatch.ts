import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useTerminalBatch(id: number | null) {
  return useQuery({
    queryKey: id ? ['treasury', 'terminalBatch', id] : ['treasury', 'terminalBatch', 'noop'],
    queryFn: async () => {
      const res = await api.get(`/treasury/terminal-batches/${id}/`)
      return res.data
    },
    enabled: !!id,
  })
}
