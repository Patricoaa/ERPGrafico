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

import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    defaultPageSize?: number
    pageSizeOptions?: number[]
    filterColumn?: string
    searchPlaceholder?: string
    globalFilterFields?: string[] // Fields to include in global search
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
}

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {}

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
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [globalFilter, setGlobalFilter] = React.useState("")

    // Merge initial visibility with hidden columns
    const visibilityState = React.useMemo(() => {
        const visibility = { ...initialColumnVisibility }
        hiddenColumns.forEach(col => {
            visibility[col] = false
        })
        return visibility
    }, [initialColumnVisibility, hiddenColumns])

    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(visibilityState)
    const [rowSelection, setRowSelection] = React.useState({})

    // Sync visibility with props
    React.useEffect(() => {
        if (JSON.stringify(columnVisibility) !== JSON.stringify(initialColumnVisibility)) {
            setColumnVisibility(initialColumnVisibility)
        }
    }, [initialColumnVisibility])

    // Trigger callback when rowSelection changes
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

    return (
        <div className="space-y-4">
            {(filterColumn || globalFilterFields || (facetedFilters && facetedFilters.length > 0) || toolbarAction) && (
                <DataTableToolbar
                    table={table}
                    filterColumn={filterColumn}
                    globalFilterFields={globalFilterFields}
                    searchPlaceholder={searchPlaceholder}
                    facetedFilters={facetedFilters}
                    toolbarAction={toolbarAction}
                />
            )}
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
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="group hover:bg-muted/20 transition-colors"
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
            <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
        </div>
    )
}
