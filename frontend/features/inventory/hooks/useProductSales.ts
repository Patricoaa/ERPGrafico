"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { SalesParams, ProductSales } from "../analytics/sales.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Sales volume, customers and mix for one product. */
export function useProductSales(productId: number | null | undefined, params: SalesParams) {
    const { data, isLoading, isError } = useQuery<ProductSales | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "sales", params]
            : [...PRODUCTS_KEYS.all, "sales", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductSales(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; a granularity change alone keeps the previous data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as SalesParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
