"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { Sourcing, SourcingParams } from "../analytics/sourcing.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Make-vs-buy comparison and input-usage sensitivity for one product. */
export function useProductSourcing(productId: number | null | undefined, params: SourcingParams) {
    const { data, isLoading, isError } = useQuery<Sourcing | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "sourcing", params]
            : [...PRODUCTS_KEYS.all, "sourcing", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductSourcing(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
    })
    return { data: data ?? null, isLoading, isError }
}
