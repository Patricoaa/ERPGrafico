"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFacetedUniqueValues,
    getFacetedRowModel,
    useReactTable,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    defaultPageSize?: number
    pageSizeOptions?: number[]
    filterColumn?: string
    searchPlaceholder?: string
    globalFilterFields?: string[]
    facetedFilters?: {
        column: string
        title: string
        options?: {
            label: string
            value: string
            icon?: React.ComponentType<{ className?: string }>
        }[]
    }[]
    toolbarAction?: React.ReactNode
    onRowSelectionChange?: (selection: any) => void
    initialColumnVisibility?: VisibilityState
    hiddenColumns?: string[]
    useAdvancedFilter?: boolean
    onReset?: () => void
    renderCustomView?: (table: any) => React.ReactNode
    rightAction?: React.ReactNode
    showToolbarSort?: boolean
    onRowClick?: (row: TData) => void
    // Card mode
    cardMode?: boolean
    isLoading?: boolean
    skeletonRows?: number
}

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {}

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                    {Array.from({ length: columns }).map((_, j) => (
                        <TableCell key={j} className="py-3">
                            <Skeleton className={cn(
                                "h-4 rounded-md",
                                j === 0 ? "w-[60%]" :
                                j === columns - 1 ? "w-[60px] mx-auto" :
                                "w-[80%]"
                            )} />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    )
}

export function DataTable<TData, TValue>({
    columns,
    data,
    defaultPageSize = 20,
    pageSizeOptions = [10, 20, 50, 100],
    filterColumn,
    searchPlaceholder,
    globalFilterFields,
    facetedFilters,
    toolbarAction,
    onRowSelectionChange,
    initialColumnVisibility = DEFAULT_COLUMN_VISIBILITY,
    hiddenColumns = [],
    useAdvancedFilter = false,
    onReset,
    renderCustomView,
    rightAction,
    showToolbarSort,
    onRowClick,
    cardMode = false,
    isLoading = false,
    skeletonRows = 5,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [globalFilter, setGlobalFilter] = React.useState("")

    const visibilityState = React.useMemo(() => {
        const visibility = { ...initialColumnVisibility }
        hiddenColumns.forEach(col => {
            visibility[col] = false
        })
        return visibility
    }, [initialColumnVisibility, hiddenColumns])

    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(visibilityState)
    const [rowSelection, setRowSelection] = React.useState({})

    React.useEffect(() => {
        if (JSON.stringify(columnVisibility) !== JSON.stringify(initialColumnVisibility)) {
            setColumnVisibility(initialColumnVisibility)
        }
    }, [initialColumnVisibility])

    const prevRowSelection = React.useRef(rowSelection)
    React.useEffect(() => {
        if (JSON.stringify(prevRowSelection.current) !== JSON.stringify(rowSelection)) {
            onRowSelectionChange?.(rowSelection)
            prevRowSelection.current = rowSelection
        }
    }, [rowSelection, onRowSelectionChange])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            globalFilter,
            columnVisibility,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: defaultPageSize,
            },
            columnVisibility: initialColumnVisibility,
        },
    })

    const showToolbar = filterColumn || globalFilterFields || (facetedFilters && facetedFilters.length > 0) || toolbarAction || rightAction

    // ─── Card Mode ────────────────────────────────────────────────────────────
    if (cardMode) {
        const tableBody = isLoading ? (
            <TableSkeleton rows={skeletonRows} columns={columns.length} />
        ) : renderCustomView ? null : (
            table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={cn(
                            "hover:bg-muted/20 transition-colors",
                            onRowClick && "cursor-pointer"
                        )}
                        onClick={() => onRowClick?.(row.original)}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-3">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))
            ) : (
                <TableRow>
                    <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                    >
                        No se encontraron resultados.
                    </TableCell>
                </TableRow>
            )
        )

        return (
            <Card>
                {/* Flat toolbar — no divider line, padding only */}
                {showToolbar && (
                    <div className="flex items-center px-4 pt-3 pb-1">
                        <DataTableToolbar
                            table={table}
                            filterColumn={filterColumn}
                            globalFilterFields={globalFilterFields}
                            searchPlaceholder={searchPlaceholder}
                            facetedFilters={facetedFilters}
                            toolbarAction={toolbarAction}
                            useAdvancedFilter={useAdvancedFilter}
                            onReset={onReset}
                            rightAction={rightAction}
                            showToolbarSort={showToolbarSort}
                        />
                    </div>
                )}

                <CardContent className="px-4 pb-0">
                    {renderCustomView ? (
                        renderCustomView(table)
                    ) : (
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow
                                        key={headerGroup.id}
                                        className="border-b border-border/50 hover:bg-transparent"
                                    >
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="bg-transparent h-9 text-center"
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {tableBody}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>

                {/* Flat pagination — subtle top border, no card divider */}
                <div className="px-4 py-2 mt-1 border-t border-border/30">
                    <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
                </div>
            </Card>
        )
    }

    // ─── Classic Mode (unchanged) ─────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {showToolbar && (
                <DataTableToolbar
                    table={table}
                    filterColumn={filterColumn}
                    globalFilterFields={globalFilterFields}
                    searchPlaceholder={searchPlaceholder}
                    facetedFilters={facetedFilters}
                    toolbarAction={toolbarAction}
                    useAdvancedFilter={useAdvancedFilter}
                    onReset={onReset}
                    rightAction={rightAction}
                    showToolbarSort={showToolbarSort}
                />
            )}
            {renderCustomView ? (
                renderCustomView(table)
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableSkeleton rows={skeletonRows} columns={columns.length} />
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={cn(
                                            "group hover:bg-muted/20 transition-colors",
                                            onRowClick && "cursor-pointer"
                                        )}
                                        onClick={() => onRowClick?.(row.original)}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                    >
                                        No se encontraron resultados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
            <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
        </div>
    )
}
