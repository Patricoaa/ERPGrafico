'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/features/inventory/api/inventoryApi'
import type { ProductFilters } from '@/features/inventory/types'

export function useWorkOrderProducts(otType: 'LINKED' | 'NONE' | null, searchTerm: string) {
  return useInfiniteQuery({
    queryKey: ['production', 'products', otType, searchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const filters: ProductFilters = {
        is_active: true,
        search: searchTerm,
        page_size: 20,
        ...(otType === "NONE"
          ? { product_type: "MANUFACTURABLE", track_inventory: true }
          : { can_be_sold: true }),
      }
      return inventoryApi.getProducts(filters)
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length : undefined,
    enabled: otType === "NONE",
  })
}
