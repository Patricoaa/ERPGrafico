"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { Operations, OperationsParams } from "../analytics/operations.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Stock rotation/coverage and subscription costs for one product. */
export function useProductOperations(productId: number | null | undefined, params: OperationsParams) {
    const { data, isLoading, isError } = useQuery<Operations | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "operations", params]
            : [...PRODUCTS_KEYS.all, "operations", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductOperations(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        placeholderData: keepPreviousData,
    })
    return { data: data ?? null, isLoading, isError }
}
