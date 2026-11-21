"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { PricingParams, ProductPricing } from "../analytics/pricing.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Price, realized margin and price-change effects on sales for one product. */
export function useProductPricing(productId: number | null | undefined, params: PricingParams) {
    const { data, isLoading, isError } = useQuery<ProductPricing | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "pricing", params]
            : [...PRODUCTS_KEYS.all, "pricing", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductPricing(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; a granularity change alone keeps the previous data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as PricingParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
