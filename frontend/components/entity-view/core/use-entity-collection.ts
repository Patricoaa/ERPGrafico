"use client"

import * as React from "react"
import {
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type PaginationState,
    type RowSelectionState,
    type SortingState,
    type Table,
} from "@tanstack/react-table"
import { rowIdOf, sortValueOf, type Entity, type FieldId, type FieldMap, type SortSpec } from "./define-entity"

/** Data handed over by the feature hook (invariant #5: queries live in features/*\/hooks). */
export interface CollectionSource<T> {
    rows: readonly T[] | undefined
    isLoading?: boolean
    isRefetching?: boolean
    error?: unknown
    /** Server total (required with server pagination, pagination-contract §3.2). */
    rowCount?: number
    /** Retry action for the error state (e.g. TanStack Query `refetch`). */
    refetch?: () => void
    /** True when the empty result comes from an active search/filter (copy differs). */
    isFiltered?: boolean
}

export type CollectionPagination =
    | { mode: "client"; pageSize?: number }
    | { mode: "server"; state: PaginationState; onChange: (next: PaginationState) => void }
    | { mode: "none" }

export interface CollectionOptions<Id extends string> {
    pagination?: CollectionPagination
    defaultSort?: SortSpec<Id>
}

export type CollectionStatus = "loading" | "error" | "empty" | "ready"

export interface EntityCollection<T, F extends FieldMap<T>> {
    entity: Entity<T, F>
    table: Table<T>
    status: CollectionStatus
    isRefetching: boolean
    /** Total rows (server total when paginating on the server). */
    total: number
    paginated: boolean
    refetch?: () => void
    isFiltered: boolean
}

function toSorting<Id extends string>(spec: SortSpec<Id> | undefined): SortingState {
    if (!spec) return []
    return spec.startsWith("-") ? [{ id: spec.slice(1), desc: true }] : [{ id: spec, desc: false }]
}

const EMPTY_ROWS: never[] = []

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
    const rows = (source.rows ?? EMPTY_ROWS) as T[]

    const columns = React.useMemo<ColumnDef<T>[]>(
        () =>
            entity.ids.map((id) => {
                const def = entity.fields[id]
                return {
                    id,
                    accessorFn: (row: T) => sortValueOf(def, row),
                    enableSorting: def.sortable ?? true,
                    sortUndefined: "last",
                }
            }),
        [entity],
    )

    const [sorting, setSorting] = React.useState<SortingState>(() => toSorting(options.defaultSort))
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
    const [clientPagination, setClientPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: pagination.mode === "client" ? pagination.pageSize ?? 20 : 20,
    })

    const isServer = pagination.mode === "server"
    const table = useReactTable<T>({
        data: rows,
        columns,
        state: {
            sorting,
            rowSelection,
            // Omitted (not `undefined`) without pagination, so TanStack keeps its default pagination state.
            ...(pagination.mode === "none" ? {} : { pagination: pagination.mode === "server" ? pagination.state : clientPagination }),
        },
        getRowId: (row) => rowIdOf(entity, row),
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: (updater) => {
            if (pagination.mode === "server") {
                pagination.onChange(typeof updater === "function" ? updater(pagination.state) : updater)
            } else {
                setClientPagination(updater)
            }
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        ...(pagination.mode === "client" ? { getPaginationRowModel: getPaginationRowModel() } : {}),
        manualPagination: isServer,
        rowCount: isServer ? source.rowCount : undefined,
        enableRowSelection: true,
    })

    const status: CollectionStatus = source.isLoading
        ? "loading"
        : source.error
            ? "error"
            : rows.length === 0
                ? "empty"
                : "ready"

    return {
        entity,
        table,
        status,
        isRefetching: !!source.isRefetching,
        total: isServer ? source.rowCount ?? rows.length : rows.length,
        paginated: pagination.mode !== "none",
        refetch: source.refetch,
        isFiltered: !!source.isFiltered,
    }
}
