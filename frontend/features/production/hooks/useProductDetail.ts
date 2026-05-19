import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ProductMinimal } from '../types'

export function useProductDetail(
  productId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery<ProductMinimal | null>({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) return null
      const res = await api.get(`/inventory/products/${productId}/`)
      return res.data as ProductMinimal
    },
    enabled: (options.enabled ?? true) && !!productId,
  })
}
