"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { CostsParams, ProductCosts } from "../analytics/costs.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Cost of one product by cost mode (purchased, manufactured with/without stock or BOM, stock only). */
export function useProductCosts(productId: number | null | undefined, params: CostsParams) {
    const { data, isLoading, isError } = useQuery<ProductCosts | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "costs", params]
            : [...PRODUCTS_KEYS.all, "costs", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductCosts(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; a granularity change alone keeps the previous data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as CostsParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
