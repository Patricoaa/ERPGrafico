"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import type { FacetCounts } from "@/lib/facets"

export interface UseFacetCountsOptions {
    /** `useCollectionQuery().facetFields`: the params of the filters with `counts: true`. Empty: no request. */
    fields: readonly string[]
    /** List params (search, filters). The order does not change the counts, so `ordering` is left out. */
    params: Record<string, string>
    /** Query-key prefix of the feature list, so its invalidations refresh the counts too. */
    queryKey: readonly unknown[]
    fetchFacets: (params: Record<string, string>, fields: readonly string[]) => Promise<FacetCounts>
}

/**
 * Per-option counts of a list's filters (ADR-0158 §8, `facets/`). `null` while loading, on error, or
 * when no filter asks for counts: the menu then shows plain options.
 */
export function useFacetCounts({ fields, params, queryKey, fetchFacets }: UseFacetCountsOptions): FacetCounts | null {
    const scoped = React.useMemo(() => Object.fromEntries(Object.entries(params).filter(([key]) => key !== "ordering")), [params])
    const { data } = useQuery({
        queryKey: [...queryKey, "facets", fields, scoped],
        queryFn: () => fetchFacets(scoped, fields),
        enabled: fields.length > 0,
        placeholderData: (prev) => prev,
    })
    return fields.length > 0 ? data ?? null : null
}
