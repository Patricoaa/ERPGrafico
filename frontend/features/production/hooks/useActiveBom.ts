import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { staleTime } from '@/lib/query-config'

export interface BomSuggestion {
  active: boolean
  estimated_prepress_min: number
  estimated_press_min: number
  estimated_postpress_min: number
}

export function useActiveBom(
  productId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery<BomSuggestion | null>({
    queryKey: ['bom-suggestion', productId],
    queryFn: async () => {
      const res = await api.get<{ results: BomSuggestion[] }>(`/production/boms/?product_id=${productId}`)
      return res.data.results.find((b) => b.active) ?? null
    },
    staleTime: staleTime.stable,
    enabled: (options.enabled ?? true) && !!productId,
  })
}
