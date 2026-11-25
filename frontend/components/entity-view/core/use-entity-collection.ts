"use client"

import * as React from "react"
import {
    getCoreRowModel,
    getExpandedRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type ExpandedState,
    type PaginationState,
    type Row,
    type RowSelectionState,
    type SortingState,
    type Table,
} from "@tanstack/react-table"
import { groupItems } from "@/lib/group-utils"
import { EMPTY } from "./formatters"
import { resolveField, rowIdOf, sortValueOf, type Entity, type FieldId, type FieldMap, type SortSpec } from "./define-entity"

/** Data handed over by the feature hook (invariant #5: queries live in features/*\/hooks). */
export interface CollectionSource<T> {
    rows: readonly T[] | undefined
    isLoading?: boolean
    isRefetching?: boolean
    error?: unknown
    /** Server total (required with server pagination, pagination-contract §3.2; also while grouping a bounded page). */
    rowCount?: number
    /** Retry action for the error state (e.g. TanStack Query `refetch`). */
    refetch?: () => void
    /** True when the empty result comes from an active search/filter (copy differs). */
    isFiltered?: boolean
}

export type CollectionPagination =
    | { mode: "client"; pageSize?: number }
    /** Client-side "Mostrar más" (ADR-0137): the first `step` rows, then `step` more per click. Never server-driven. */
    | { mode: "more"; step?: number }
    | { mode: "server"; state: PaginationState; onChange: (next: PaginationState) => void }
    | { mode: "none" }

/**
 * Sorting. `local` (default) sorts the loaded rows by each kind's semantic key. `server` is
 * controlled by the page (e.g. URL + `orderingParam`): rows arrive already sorted, and only fields
 * with an `orderBy` key are sortable, so a paginated list is never reordered page by page.
 * `query` sorts the loaded rows like `local`, by keys the page controls (`useCollectionQuery` in client
 * mode, ADR-0158): every key sorts, and a header click reports only the new first key, as in `server`.
 */
export type CollectionSorting<Id extends string> =
    | { mode: "local" }
    | { mode: "server"; state: SortSpec<Id> | null; onChange: (next: SortSpec<Id> | null) => void }
    | { mode: "query"; state: readonly SortSpec<Id>[]; onChange: (next: SortSpec<Id> | null) => void; fields: readonly Id[] }

export interface CollectionOptions<Id extends string> {
    pagination?: CollectionPagination
    sorting?: CollectionSorting<Id>
    defaultSort?: SortSpec<Id>
    /**
     * Groups the loaded rows by a field's formatted text (same text as the cell). Grouping happens
     * on the rows the page loaded: a server-paginated list should load one bounded page while grouping
     * (Gate D lote 2: `GROUP_ROW_LIMIT`) and pass `rowCount` so the surfaces can warn when it is truncated.
     */
    groupBy?: Id | null
}

/** Uniform row cap while grouping (Gate D lote 2): beyond it the surfaces show a "refine the filter" notice. */
export const GROUP_ROW_LIMIT = 200

export interface CollectionGroup<T> {
    key: string
    label: string
    rows: Row<T>[]
}

/** How the collection is paged: drives the footer each surface renders (`pages` paginator vs "Mostrar más"). */
export type CollectionPaging = "none" | "server" | "client" | "more"

/** Rows revealed per "Mostrar más" click when the collection does not declare its own step. */
export const DEFAULT_MORE_STEP = 10

export type CollectionStatus = "loading" | "error" | "empty" | "ready"

export interface EntityCollection<T, F extends FieldMap<T>> {
    entity: Entity<T, F>
    table: Table<T>
    status: CollectionStatus
    isRefetching: boolean
    /** Total rows (server total when paginating on the server). */
    total: number
    paginated: boolean
    /** Paging flavour (`paginated` is `paging !== "none"`). */
    paging: CollectionPaging
    /** Rows added per "Mostrar más" click. */
    moreStep: number
    refetch?: () => void
    isFiltered: boolean
    /** Row groups when `groupBy` is set (in display order), otherwise `null`. */
    groups: CollectionGroup<T>[] | null
    /** True when grouping shows fewer rows than the server total (`rowCount`). */
    truncated: boolean
}

function toSpec<Id extends string>(state: SortingState): SortSpec<Id> | null {
    const first = state[0]
    if (!first) return null
    return (first.desc ? `-${first.id}` : first.id) as SortSpec<Id>
}

function toSorting<Id extends string>(spec: SortSpec<Id> | readonly SortSpec<Id>[] | null | undefined): SortingState {
    if (!spec) return []
    const specs: readonly string[] = typeof spec === "string" ? [spec] : spec
    return specs.map((s) => (s.startsWith("-") ? { id: s.slice(1), desc: true } : { id: s, desc: false }))
}

const EMPTY_ROWS: never[] = []

const NO_SERVER_SORT = { mode: "server" as const, state: null, onChange: () => undefined }

/**
 * Headless collection state (ADR-0087 §4): TanStack model shared by every surface
 * (table, card grid, kanban). Columns are derived from the entity fields; each surface
 * decides which ones it shows. Sorting uses each kind's semantic sort key.
 */
export function useEntityCollection<T, F extends FieldMap<T>>(
    entity: Entity<T, F>,
    source: CollectionSource<T>,
    options: CollectionOptions<FieldId<F>> = {},
): EntityCollection<T, F> {
    const pagination = options.pagination ?? { mode: "client" }
    // Default: local sorting, except with server pagination, where reordering one page would misrepresent
    // the order. There it behaves as server sorting with no spec: only `orderBy` fields could sort, and
    // without an `onChange` none does.
    const sortingOption: CollectionSorting<FieldId<F>> = options.sorting ?? (pagination.mode === "server" ? NO_SERVER_SORT : { mode: "local" })
    const serverSorting = sortingOption.mode === "server"
    const sortDisabled = sortingOption === NO_SERVER_SORT
    const queryFields = sortingOption.mode === "query" ? sortingOption.fields : null
    const rows = (source.rows ?? EMPTY_ROWS) as T[]

    const columns = React.useMemo<ColumnDef<T>[]>(
        () =>
            entity.ids.map((id) => {
                const def = entity.fields[id]
                return {
                    id,
                    accessorFn: (row: T) => sortValueOf(def, row),
                    enableSorting: (def.sortable ?? true) && (!serverSorting || (!!def.orderBy && !sortDisabled)) && (!queryFields || queryFields.includes(id)),
                    sortUndefined: "last",
                }
            }),
        [entity, serverSorting, sortDisabled, queryFields],
    )

    const [localSorting, setLocalSorting] = React.useState<SortingState>(() => toSorting(options.defaultSort))
    const controlledSpec = sortingOption.mode === "server" || sortingOption.mode === "query" ? sortingOption.state : null
    // Stable identity per spec: a new array each render would invalidate TanStack's row models (and the groups).
    // A `query` spec is an array: keyed by its text so a new array with the same keys keeps the state.
    const controlledKey = controlledSpec === null ? null : typeof controlledSpec === "string" ? controlledSpec : controlledSpec.join(",")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by text: see above
    const controlledSortingState = React.useMemo(() => toSorting(controlledSpec), [controlledKey])
    const sorting = sortingOption.mode === "local" ? localSorting : controlledSortingState
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
    const tree = entity.tree
    // `true` = every branch open (TanStack's "all expanded"); toggling a row switches to a per-row map.
    const [expanded, setExpanded] = React.useState<ExpandedState>(() => (tree && tree.defaultExpanded !== false ? true : {}))
    const moreStep = pagination.mode === "more" ? pagination.step ?? DEFAULT_MORE_STEP : DEFAULT_MORE_STEP
    const [clientPagination, setClientPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: pagination.mode === "client" ? pagination.pageSize ?? 20 : pagination.mode === "more" ? moreStep : 20,
    })

    const isServer = pagination.mode === "server"
    // Client pages are clamped, not auto-reset: TanStack's autoResetPageIndex resets on every new
    // `rows` array, which loops with views that filter in render (`search.filterFn(rows)`). A filter
    // that shrinks the list keeps the user on the last existing page instead.
    const lastClientPage = Math.max(0, Math.ceil(rows.length / clientPagination.pageSize) - 1)
    const clientPage = React.useMemo(
        () => (clientPagination.pageIndex > lastClientPage ? { ...clientPagination, pageIndex: lastClientPage } : clientPagination),
        [clientPagination, lastClientPage],
    )
    // With server pagination every page/sort/filter brings new rows: a selection made on another
    // page would no longer be visible, and the dock count and the bulk action targets would disagree.
    React.useEffect(() => {
        // Idempotent: a new empty `rows` array per render must not loop.
        if (isServer) setRowSelection((current) => (Object.keys(current).length === 0 ? current : {}))
    }, [isServer, rows])
    const table = useReactTable<T>({
        data: rows,
        columns,
        state: {
            sorting,
            rowSelection,
            ...(tree ? { expanded } : {}),
            // Omitted (not `undefined`) without pagination, so TanStack keeps its default pagination state.
            ...(pagination.mode === "none" ? {} : { pagination: pagination.mode === "server" ? pagination.state : clientPage }),
        },
        // Derived lists (dry-run warnings, simulation previews) are not table records: they carry neither
        // `id` nor `rowId`. Fall back to the row index, TanStack's default, so they keep unique keys
        // instead of sharing `""` (which duplicates keys and collapses row selection into one row).
        getRowId: (row, index) => rowIdOf(entity, row) || `row-${index}`,
        ...(tree
            ? {
                getSubRows: (row: T) => (tree.children(row) ?? undefined) as T[] | undefined,
                getExpandedRowModel: getExpandedRowModel(),
                onExpandedChange: setExpanded,
                // A client page holds whole branches (children render on their parent's page). TanStack then
                // expands inside its pagination model, so this only applies when that model exists.
                paginateExpandedRows: pagination.mode !== "client" && pagination.mode !== "more",
            }
            : {}),
        onSortingChange: (updater) => {
            // `query`: the header acts on the first key only (secondary keys live in `SortMenu`), as in `server`.
            const current = sortingOption.mode === "query" ? sorting.slice(0, 1) : sorting
            const next = typeof updater === "function" ? updater(current) : updater
            if (sortingOption.mode === "local") setLocalSorting(next)
            else sortingOption.onChange(toSpec<FieldId<F>>(next))
        },
        manualSorting: serverSorting,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: (updater) => {
            if (pagination.mode === "server") {
                pagination.onChange(typeof updater === "function" ? updater(pagination.state) : updater)
            } else {
                setClientPagination(typeof updater === "function" ? updater(clientPage) : updater)
            }
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        ...(pagination.mode === "client" || pagination.mode === "more" ? { getPaginationRowModel: getPaginationRowModel() } : {}),
        manualPagination: isServer,
        autoResetPageIndex: false,
        rowCount: isServer ? source.rowCount : undefined,
        enableRowSelection: true,
        // Ticking a parent selects that row only, never its whole subtree.
        enableSubRowSelection: false,
    })

    // Rows win over a failed background refetch: cached data stays visible (legacy DataTableView parity).
    const status: CollectionStatus = source.isLoading
        ? "loading"
        : rows.length > 0
            ? "ready"
            : source.error
                ? "error"
                : "empty"

    // Grouping does not apply to a tree (the hierarchy already is the grouping).
    const groupBy = tree ? null : options.groupBy ?? null
    const pageRows = table.getRowModel().rows
    const groups = React.useMemo<CollectionGroup<T>[] | null>(() => {
        if (!groupBy) return null
        const def = entity.fields[groupBy]
        // Same grouping helper as the legacy grouped views: sorted keys, missing values in a last "Sin …" group.
        return groupItems(pageRows, groupBy, {
            sort: "asc",
            getValue: (row) => resolveField(def, row.original).text,
            parseValue: (text) => (text === EMPTY ? null : String(text)),
            defaultLabel: `Sin ${def.label.toLowerCase()}`,
        }).map((group) => ({ key: group.key, label: group.label, rows: group.items }))
    }, [groupBy, entity, pageRows])

    return {
        entity,
        table,
        groups,
        truncated: !!groupBy && source.rowCount !== undefined && source.rowCount > rows.length,
        status,
        isRefetching: !!source.isRefetching,
        // `rowCount` is the server total whenever the page passes it (server pages, or one bounded page while grouping).
        // A tree counts every row, not only its roots.
        total: source.rowCount ?? (tree ? table.getCoreRowModel().flatRows.length : rows.length),
        paginated: pagination.mode !== "none",
        paging: pagination.mode,
        moreStep,
        refetch: source.refetch,
        isFiltered: !!source.isFiltered,
    }
}
