"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProductionPerformance, ProductionPerformanceParams } from "../analytics/productionPerformance.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Real cost vs BOM, material deviation, stage times and margin per work order for one product. */
export function useProductProductionPerformance(productId: number | null | undefined, params: ProductionPerformanceParams) {
    const { data, isLoading, isError } = useQuery<ProductionPerformance | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "production-performance", params]
            : [...PRODUCTS_KEYS.all, "production-performance", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductProductionPerformance(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
    })
    return { data: data ?? null, isLoading, isError }
}
