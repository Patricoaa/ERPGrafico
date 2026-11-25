"use client"

import * as React from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import type { Page } from "@/lib/pagination"
import { serverGroupId, type ServerGroup, type ServerGroupState } from "@/lib/server-groups"

/** Groups open when a grouping loads; the rest load their rows when the user opens them. */
const INITIALLY_OPEN = 3
const DEFAULT_PAGE_SIZE = 20
const NO_PAGES: Record<string, number> = {}

export interface UseServerGroupsOptions<T> {
    /** Server grouping key (`useCollectionQuery().groupKey`); `null` disables the hook. */
    groupKey: string | null
    /** List params (search, filters, ordering): the groups and their rows share them. */
    params: Record<string, string>
    /** Query-key prefix of the feature list (e.g. `SALES_KEYS.all`), so its invalidations reach the groups. */
    queryKey: readonly unknown[]
    fetchGroups: (params: Record<string, string>) => Promise<ServerGroup[]>
    /** One page of the list with the group's params merged in. */
    fetchRows: (params: Record<string, string>, page: number, pageSize: number) => Promise<Page<T>>
    pageSize?: number
}

export interface ServerGroupsResult<T> {
    /** Groups in display order, or `null` when not grouping on the server. */
    groups: ServerGroupState<T>[] | null
    isLoading: boolean
    isRefetching: boolean
    isError: boolean
    refetch: () => void
}

interface PageResult<T> {
    page: Page<T> | undefined
    isLoading: boolean
    isError: boolean
}

/** Module-level `combine`: TanStack keeps its result stable while the queries do not change. */
function summarize<T>(results: { data: Page<T> | undefined; isLoading: boolean; isError: boolean }[]): PageResult<T>[] {
    return results.map((r) => ({ page: r.data, isLoading: r.isLoading, isError: r.isError }))
}

/**
 * Server grouping (ADR-0158 §7): `groups/` gives every group of the filtered list with its count and
 * sums; each open group pages its own rows through the list endpoint («Mostrar más»). Changing the
 * grouping or the filters resets which groups are open.
 */
export function useServerGroups<T>({ groupKey, params, queryKey, fetchGroups, fetchRows, pageSize = DEFAULT_PAGE_SIZE }: UseServerGroupsOptions<T>): ServerGroupsResult<T> {
    const enabled = groupKey !== null
    const groupParams = React.useMemo(() => ({ ...params, group_by: groupKey ?? "" }), [params, groupKey])
    const groupsQuery = useQuery({
        queryKey: [...queryKey, "groups", groupParams],
        queryFn: () => fetchGroups(groupParams),
        enabled,
        placeholderData: (prev) => prev,
    })
    const serverGroups = React.useMemo(() => (enabled ? groupsQuery.data ?? [] : []), [enabled, groupsQuery.data])

    // Pages loaded per open group, scoped to this grouping + filters: a new scope starts from the defaults.
    const scope = JSON.stringify(groupParams)
    const [pagesState, setPagesState] = React.useState<{ scope: string; pages: Record<string, number> }>({ scope, pages: {} })
    const overrides = React.useMemo(() => (pagesState.scope === scope ? pagesState.pages : NO_PAGES), [pagesState, scope])
    const pagesOf = React.useCallback(
        (id: string, index: number) => overrides[id] ?? (index < INITIALLY_OPEN ? 1 : 0),
        [overrides],
    )
    const setPages = React.useCallback(
        (id: string, next: number) => setPagesState((prev) => ({ scope, pages: { ...(prev.scope === scope ? prev.pages : {}), [id]: next } })),
        [scope],
    )

    const pageRequests = React.useMemo(
        () => serverGroups.flatMap((group, index) => {
            const id = serverGroupId(group)
            if (!group.params) return []
            return Array.from({ length: pagesOf(id, index) }, (_, i) => ({ id, page: i + 1, params: { ...params, ...group.params } }))
        }),
        [serverGroups, pagesOf, params],
    )
    const pageResults = useQueries({
        queries: pageRequests.map((req) => ({
            queryKey: [...queryKey, "group-rows", req.params, req.page, pageSize],
            queryFn: () => fetchRows(req.params, req.page, pageSize),
            enabled,
        })),
        combine: summarize<T>,
    })

    const groups = React.useMemo<ServerGroupState<T>[] | null>(() => {
        if (!enabled) return null
        return serverGroups.map((group, index) => {
            const id = serverGroupId(group)
            const pages = pagesOf(id, index)
            const results = pageResults.filter((_, i) => pageRequests[i]?.id === id)
            const last = results[results.length - 1]
            return {
                ...group,
                id,
                open: pages > 0,
                rows: results.flatMap((r) => r.page?.results ?? []),
                isLoading: results.some((r) => r.isLoading),
                isError: results.some((r) => r.isError),
                hasMore: pages > 0 && !!last?.page?.hasNextPage,
                toggle: () => setPages(id, pages > 0 ? 0 : 1),
                showMore: () => setPages(id, pages + 1),
            }
        })
    }, [enabled, serverGroups, pagesOf, setPages, pageResults, pageRequests])

    return {
        groups,
        isLoading: enabled && groupsQuery.isLoading,
        isRefetching: enabled && groupsQuery.isFetching && !groupsQuery.isLoading,
        isError: enabled && groupsQuery.isError,
        refetch: () => void groupsQuery.refetch(),
    }
}
