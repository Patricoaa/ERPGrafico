'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/features/inventory'
import type { ProductFilters } from '@/features/inventory'
import type { Product } from '@/features/inventory'

export function useWorkOrderProducts(otType: 'LINKED' | 'NONE' | null, searchTerm: string) {
  return useInfiniteQuery({
    queryKey: ['production', 'products', otType, searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const filters: ProductFilters = {
        is_active: true,
        search: searchTerm,
        page: pageParam as number,
        page_size: 20,
        ...(otType === "NONE"
          ? { product_type: "MANUFACTURABLE", track_inventory: true }
          : { can_be_sold: true }),
      }
      return inventoryApi.getProducts(filters)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      (lastPage.results?.length ?? 0) === 20 ? allPages.length + 1 : undefined,
    enabled: otType === "NONE",
  })
}
