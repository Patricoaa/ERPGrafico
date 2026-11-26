"use client"

import { useFacetCounts } from "@/hooks/useFacetCounts"
import type { FacetViews } from "@/lib/facets"
import { purchasingApi, type OrderFilters } from "../api/purchasingApi"
import { PURCHASING_KEYS } from "./queryKeys"

interface FacetsArgs {
    fields: readonly string[]
    views: FacetViews
    params: Record<string, string>
}

const orderFacets = (params: Record<string, string>, fields: readonly string[], views: FacetViews) => purchasingApi.getOrderFacets(params as OrderFilters, fields, views)

/** View totals of the purchase orders (ADR-0158 §8). */
export function usePurchaseOrderFacets({ fields, views, params }: FacetsArgs) {
    return useFacetCounts({ fields, views, params, queryKey: PURCHASING_KEYS.orders(), fetchFacets: orderFacets })
}

/** Status option counts and view totals of the purchase receipts (ADR-0158 §8). */
export function usePurchaseReceiptFacets({ fields, views, params }: FacetsArgs) {
    return useFacetCounts({ fields, views, params, queryKey: [...PURCHASING_KEYS.all, "receipts"], fetchFacets: purchasingApi.getReceiptFacets })
}

/** Status option counts and view totals of the purchase returns (ADR-0158 §8). */
export function usePurchaseReturnFacets({ fields, views, params }: FacetsArgs) {
    return useFacetCounts({ fields, views, params, queryKey: [...PURCHASING_KEYS.all, "returns"], fetchFacets: purchasingApi.getReturnFacets })
}
