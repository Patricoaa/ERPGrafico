"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import type { FacetCounts, FacetViews } from "@/lib/facets"

export interface UseFacetCountsOptions {
    /** `useCollectionQuery().facetFields`: the params of the filters with `counts: true`. */
    fields: readonly string[]
    /** `useCollectionQuery().facetViews`: the params of the views with `count: true`. */
    views: FacetViews
    /** List params (search, filters). The order does not change the counts, so `ordering` is left out. */
    params: Record<string, string>
    /** Query-key prefix of the feature list, so its invalidations refresh the counts too. */
    queryKey: readonly unknown[]
    fetchFacets: (params: Record<string, string>, fields: readonly string[], views: FacetViews) => Promise<FacetCounts>
}

/**
 * Per-option counts of a list's filters and per-view totals (ADR-0158 §8, `facets/`). `null` while
 * loading, on error, or when nothing asks for counts: the menu and tabs then show no numbers.
 */
export function useFacetCounts({ fields, views, params, queryKey, fetchFacets }: UseFacetCountsOptions): FacetCounts | null {
    const scoped = React.useMemo(() => Object.fromEntries(Object.entries(params).filter(([key]) => key !== "ordering")), [params])
    const wanted = fields.length > 0 || Object.keys(views).length > 0
    const { data } = useQuery({
        queryKey: [...queryKey, "facets", fields, views, scoped],
        queryFn: () => fetchFacets(scoped, fields, views),
        enabled: wanted,
        placeholderData: (prev) => prev,
    })
    return wanted ? data ?? null : null
}
