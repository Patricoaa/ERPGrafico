import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

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
      const res = await api.get(`/production/boms/?product_id=${productId}`)
      const boms: BomSuggestion[] = res.data.results ?? res.data
      return boms.find((b) => b.active) ?? null
    },
    enabled: (options.enabled ?? true) && !!productId,
  })
}
