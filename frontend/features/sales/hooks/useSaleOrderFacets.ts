"use client"

import { useFacetCounts } from "@/hooks/useFacetCounts"
import { salesApi } from "../api/salesApi"
import type { SaleOrderFilters } from "../types"
import { SALES_KEYS } from "./queryKeys"

const fetchFacets = (params: Record<string, string>, fields: readonly string[]) => salesApi.getOrderFacets(params as SaleOrderFilters, fields)

/** Per-option counts of the sale order filters with `counts: true` (ADR-0158 §8). */
export function useSaleOrderFacets({ fields, params }: { fields: readonly string[]; params: Record<string, string> }) {
    return useFacetCounts({ fields, params, queryKey: [...SALES_KEYS.all, "orders"], fetchFacets })
}
