"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProductStockAnalysis, StockAnalysisParams } from "../analytics/stockAnalysis.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** On hand, reserved, rotation, flows, adjustments, warehouses and variants for one product. */
export function useProductStockAnalysis(productId: number | null | undefined, params: StockAnalysisParams) {
    const { data, isLoading, isError } = useQuery<ProductStockAnalysis | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "stock-analysis", params]
            : [...PRODUCTS_KEYS.all, "stock-analysis", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductStockAnalysis(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; changing only the granularity or the idle threshold keeps the data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as StockAnalysisParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
