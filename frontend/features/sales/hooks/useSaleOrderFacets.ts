"use client"

import { useFacetCounts } from "@/hooks/useFacetCounts"
import type { FacetViews } from "@/lib/facets"
import { salesApi } from "../api/salesApi"
import type { SaleOrderFilters } from "../types"
import { SALES_KEYS } from "./queryKeys"

const fetchFacets = (params: Record<string, string>, fields: readonly string[], views: FacetViews) =>
    salesApi.getOrderFacets(params as SaleOrderFilters, fields, views)

/** Filter option counts and view totals of the sale order list (ADR-0158 §8). */
export function useSaleOrderFacets({ fields, views, params }: { fields: readonly string[]; views: FacetViews; params: Record<string, string> }) {
    return useFacetCounts({ fields, views, params, queryKey: [...SALES_KEYS.all, "orders"], fetchFacets })
}
