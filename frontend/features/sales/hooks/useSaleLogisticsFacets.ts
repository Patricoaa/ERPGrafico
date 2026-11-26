"use client"

import { useFacetCounts } from "@/hooks/useFacetCounts"
import type { FacetViews } from "@/lib/facets"
import { salesApi } from "../api/salesApi"
import { SALES_KEYS } from "./queryKeys"

interface FacetsArgs {
    fields: readonly string[]
    views: FacetViews
    params: Record<string, string>
}

/** Status option counts and view totals of the sale deliveries (ADR-0158 §8). */
export function useSaleDeliveryFacets({ fields, views, params }: FacetsArgs) {
    return useFacetCounts({ fields, views, params, queryKey: [...SALES_KEYS.all, "deliveries"], fetchFacets: salesApi.getDeliveryFacets })
}

/** Status option counts and view totals of the sale returns (ADR-0158 §8). */
export function useSaleReturnFacets({ fields, views, params }: FacetsArgs) {
    return useFacetCounts({ fields, views, params, queryKey: [...SALES_KEYS.all, "returns"], fetchFacets: salesApi.getReturnFacets })
}
