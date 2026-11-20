"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { SalesImpact, SalesImpactParams } from "../analytics/salesImpact.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Sales/margin aggregation for one product, segmentable by rule, channel, customer, variant or UoM. */
export function useProductSalesImpact(productId: number | null | undefined, params: SalesImpactParams) {
    const { data, isLoading, isError } = useQuery<SalesImpact | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "sales-impact", params]
            : [...PRODUCTS_KEYS.all, "sales-impact", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductSalesImpact(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
    })
    return { data: data ?? null, isLoading, isError }
}
