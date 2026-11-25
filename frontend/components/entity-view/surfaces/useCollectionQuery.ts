"use client"

import * as React from "react"
import { parseAsString, useQueryState } from "nuqs"
import { useUnifiedSearch } from "@/components/shared"
import type { MultiSelectOption, UnifiedSearchConfig, UseUnifiedSearchReturn } from "@/types/unified-search"
import type { FieldId, SortSpec } from "../core/define-entity"
import type { CollectionSorting } from "../core/use-entity-collection"
import { MAX_SORT_KEYS, compileQuery, fromUnifiedSearchDef, orderingFor, type CompiledQuery, type QueryEntity, type QueryView } from "../core/define-query"

export interface UseCollectionQueryOptions {
    /** Screen not yet on `entity.query`: drive the same state from its `unifiedSearchDef` (adapter, ADR-0158 stage 3). */
    searchDef?: UnifiedSearchConfig
    /** Runtime options for `"remote"` / `dynamic` filters, by filter id. */
    filterOptions?: Record<string, MultiSelectOption[]>
    /**
     * `server` (default): `ordering` goes to the request. `client`: the screen loads every row; the keys
     * (still in `?ordering=`) sort them in the browser and `params` carries no `ordering`.
     */
    sorting?: "server" | "client"
}

export interface CollectionQuery<Id extends string> {
    compiled: CompiledQuery
    /** Search, filters and grouping state (also what `bindUnifiedSearch` / `UnifiedSearchBar` consume). */
    search: UseUnifiedSearchReturn
    /** Sort keys as field ids, DRF style (`["-date", "total"]`), at most `MAX_SORT_KEYS`. */
    sort: readonly SortSpec<Id>[]
    setSort: (next: readonly SortSpec<Id>[]) => void
    /** DRF `ordering` for the list request (server keys + `id` tie-break), or `undefined`. */
    ordering: string | undefined
    /** Ready for `useEntityCollection(…, { sorting })`: the table header drives the first key. */
    sorting: Extract<CollectionSorting<Id>, { mode: "server" } | { mode: "query" }>
    groupBy: Id | null
    setGroupBy: (next: Id | null) => void
    views: readonly QueryView[]
    activeView: QueryView | null
    setView: (id: string) => void
    /** Filters, sorting or grouping differ from the active view's definition («Restablecer»). */
    isDirty: boolean
    resetView: () => void
    /** List request params: search + filters (no `group_by`) + `ordering`. */
    params: Record<string, string>
}

const NON_FILTER_PARAMS = new Set(["search", "group_by"])

/** URL params a view writes: filter ids resolve to their param; other keys are raw params. */
function viewParams(compiled: CompiledQuery, view: QueryView | null): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(view?.filters ?? {})) {
        if (value === undefined) continue
        const params = compiled.filterParams[key]
        const param = params && params.length === 1 ? params[0] : key
        out[param] = typeof value === "string" ? value : value.join(",")
    }
    return out
}

function sameParams(a: Record<string, string>, b: Record<string, string>): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) if ((a[k] ?? "") !== (b[k] ?? "")) return false
    return true
}

/**
 * One owner for a collection's query state in the URL (ADR-0158 §4, collection-toolbar §4):
 * search and filters (`useUnifiedSearch`), multi-key `ordering`, `group_by` and the predefined view `v`.
 * Any change resets the cursor; `selected` is preserved.
 */
export function useCollectionQuery<F extends QueryEntity["fields"]>(
    entity: QueryEntity & { fields: F },
    { searchDef, filterOptions, sorting: sortingMode = "server" }: UseCollectionQueryOptions = {},
): CollectionQuery<FieldId<F>> {
    type Id = FieldId<F>
    const compiled = React.useMemo(() => (searchDef ? fromUnifiedSearchDef(searchDef) : compileQuery(entity, { sorting: sortingMode })), [entity, searchDef, sortingMode])
    const search = useUnifiedSearch(compiled.search, filterOptions)
    const [rawOrdering, setRawOrdering] = useQueryState("ordering", parseAsString)
    const [viewId, setViewId] = useQueryState("v", parseAsString)
    const [, setCursor] = useQueryState("cursor", parseAsString)

    const sortIds = React.useMemo(() => new Set(compiled.sortFields.map((f) => f.id)), [compiled])
    const sort = React.useMemo<SortSpec<Id>[]>(() => {
        const source = rawOrdering !== null ? rawOrdering.split(",").filter(Boolean) : compiled.defaultSort
        return source.filter((s) => sortIds.has(s.replace(/^-/, ""))).slice(0, MAX_SORT_KEYS) as SortSpec<Id>[]
    }, [rawOrdering, compiled, sortIds])

    const setSort = React.useCallback(
        (next: readonly SortSpec<Id>[]) => {
            void setCursor(null)
            void setRawOrdering(next.length === 0 ? "" : next.slice(0, MAX_SORT_KEYS).join(","))
        },
        [setCursor, setRawOrdering],
    )

    const groupIds = React.useMemo(() => new Set(compiled.groupFields.map((g) => g.id)), [compiled])
    const groupBy = search.groupBy !== null && groupIds.has(search.groupBy) ? (search.groupBy as Id) : null
    const setGroupBy = React.useCallback((next: Id | null) => void search.setGroupBy(next), [search])

    const views = compiled.views
    const activeView = views.find((v) => v.id === viewId) ?? views[0] ?? null

    const setView = React.useCallback(
        (id: string) => {
            const view = views.find((v) => v.id === id)
            if (!view) return
            void search.replaceAll({ ...viewParams(compiled, view), group_by: view.groupBy ?? null })
            void setRawOrdering(view.ordering ? view.ordering.join(",") : null)
            void setViewId(id === views[0]?.id ? null : id)
        },
        [views, compiled, search, setRawOrdering, setViewId],
    )

    // The default view's filters are written on first load when the URL carries no filter of its own.
    const hasExplicitFilters = Object.keys(search.filters).some((p) => !NON_FILTER_PARAMS.has(p))
    const defaultView = views[0]
    const appliedDefault = React.useRef(false)
    React.useEffect(() => {
        if (appliedDefault.current) return
        appliedDefault.current = true
        if (viewId === null && defaultView?.filters && Object.keys(defaultView.filters).length > 0 && !hasExplicitFilters) setView(defaultView.id)
    }, [viewId, defaultView, hasExplicitFilters, setView])

    const isDirty = React.useMemo(() => {
        if (!activeView) return false
        const current: Record<string, string> = {}
        for (const [p, v] of Object.entries(search.filters)) if (!NON_FILTER_PARAMS.has(p) && !compiled.search.searchFields.some((f) => f.serverParam === p)) current[p] = v
        if (!sameParams(current, viewParams(compiled, activeView))) return true
        if ((search.groupBy ?? "") !== (activeView.groupBy ?? "")) return true
        return rawOrdering !== (activeView.ordering ? activeView.ordering.join(",") : null)
    }, [activeView, search.filters, search.groupBy, rawOrdering, compiled])

    const resetView = React.useCallback(() => {
        if (activeView) setView(activeView.id)
    }, [activeView, setView])

    const ordering = sortingMode === "client" ? undefined : orderingFor(compiled, sort)
    const sortFieldIds = React.useMemo(() => compiled.sortFields.map((f) => f.id as Id), [compiled])
    const sorting = React.useMemo<Extract<CollectionSorting<Id>, { mode: "server" } | { mode: "query" }>>(() => {
        // A header click sets the first key and keeps the others (ADR-0158 §6).
        const onChange = (next: SortSpec<Id> | null) => setSort(next ? [next, ...sort.slice(1).filter((s) => s.replace(/^-/, "") !== next.replace(/^-/, ""))] : sort.slice(1))
        return sortingMode === "client" ? { mode: "query", state: sort, onChange, fields: sortFieldIds } : { mode: "server", state: sort[0] ?? null, onChange }
    }, [sort, setSort, sortingMode, sortFieldIds])

    const params = React.useMemo(() => {
        const out: Record<string, string> = {}
        for (const [p, v] of Object.entries(search.filters)) if (p !== "group_by") out[p] = v
        if (ordering) out.ordering = ordering
        return out
    }, [search.filters, ordering])

    return { compiled, search, sort, setSort, ordering, sorting, groupBy, setGroupBy, views, activeView, setView, isDirty, resetView, params }
}
