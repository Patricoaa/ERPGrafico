"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProductionAnalysisParams, ProductProductionAnalysis } from "../analytics/productionAnalysis.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Production of one product as manufactured (orders, rework, inputs) and as input (consumption, BOM usage). */
export function useProductProductionAnalysis(productId: number | null | undefined, params: ProductionAnalysisParams) {
    const { data, isLoading, isError } = useQuery<ProductProductionAnalysis | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "production-analysis", params]
            : [...PRODUCTS_KEYS.all, "production-analysis", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductProductionAnalysis(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; changing only the granularity or the price increase keeps the data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as ProductionAnalysisParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
