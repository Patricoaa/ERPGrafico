"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProductSubscriptionAnalysis, SubscriptionAnalysisParams } from "../analytics/subscriptionAnalysis.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Recurring cost, payments, price increases and due dates of a subscription product. */
export function useProductSubscriptionAnalysis(productId: number | null | undefined, params: SubscriptionAnalysisParams) {
    const { data, isLoading, isError } = useQuery<ProductSubscriptionAnalysis | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "subscription-analysis", params]
            : [...PRODUCTS_KEYS.all, "subscription-analysis", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductSubscriptionAnalysis(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; a granularity change alone keeps the previous data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as SubscriptionAnalysisParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
