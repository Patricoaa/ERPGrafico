"use client"

import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProcurementParams, ProductProcurement } from "../analytics/procurement.types"
import { staleTime } from "@/lib/query-config"
import { PRODUCTS_KEYS } from "./queryKeys"

/** Coverage, purchases, suppliers and pending receipts for one product. */
export function useProductProcurement(productId: number | null | undefined, params: ProcurementParams) {
    const { data, isLoading, isError } = useQuery<ProductProcurement | null>({
        queryKey: productId
            ? [...PRODUCTS_KEYS.detail(productId), "procurement", params]
            : [...PRODUCTS_KEYS.all, "procurement", "noop"],
        queryFn: async () => (productId ? inventoryApi.getProductProcurement(productId, params) : null),
        staleTime: staleTime.stable,
        enabled: !!productId,
        // A new date_from shows the skeleton; a granularity change alone keeps the previous data.
        placeholderData: (previous, previousQuery) => {
            const lastKey = previousQuery?.queryKey[previousQuery.queryKey.length - 1] as ProcurementParams | undefined
            return lastKey?.date_from === params.date_from ? previous : undefined
        },
    })
    return { data: data ?? null, isLoading, isError }
}
