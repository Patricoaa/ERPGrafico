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
    ExpandedState,
    getExpandedRowModel,
    Row,
    RowSelectionState,
    Table as ReactTable,
} from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { TableSkeleton as SharedTableSkeleton } from "@/components/shared/TableSkeleton"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { SearchX, CheckCircle2, ChevronRight, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

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
    onRowSelectionChange?: (selection: RowSelectionState) => void
    initialColumnVisibility?: VisibilityState
    hiddenColumns?: string[]
    useAdvancedFilter?: boolean
    onReset?: () => void
    renderCustomView?: (table: ReactTable<TData>) => React.ReactNode
    rightAction?: React.ReactNode
    showToolbarSort?: boolean
    onRowClick?: (row: TData) => void
    // Card mode
    cardMode?: boolean
    isLoading?: boolean
    skeletonRows?: number
    renderSubComponent?: (row: Row<TData>) => React.ReactNode
    hidePagination?: boolean
    toolbarClassName?: string
    noBorder?: boolean
    batchActions?: React.ReactNode
    viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
    currentView?: string
    onViewChange?: (view: string) => void
    showColumnToggle?: boolean
    renderFooter?: (table: ReactTable<TData>) => React.ReactNode
    customFilters?: React.ReactNode
    isCustomFiltered?: boolean
    customFilterCount?: number
    getSubRows?: (originalRow: TData, index: number) => TData[] | undefined
    autoExpand?: boolean
}

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {}


export function DataTable<TData, TValue>({
    columns,
    data,
    defaultPageSize = 20,
    pageSizeOptions = [10, 20, 50, 100, 500],
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
    renderSubComponent,
    hidePagination = false,
    toolbarClassName,
    noBorder = false,
    batchActions,
    viewOptions,
    currentView,
    onViewChange,
    showColumnToggle,
    renderFooter,
    customFilters,
    isCustomFiltered,
    customFilterCount,
    getSubRows,
    autoExpand,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [expanded, setExpanded] = React.useState<ExpandedState>(autoExpand ? true : {})
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

    const prevInitialVisibility = React.useRef(initialColumnVisibility)
    React.useEffect(() => {
        if (JSON.stringify(prevInitialVisibility.current) !== JSON.stringify(initialColumnVisibility)) {
            setColumnVisibility(visibilityState)
            prevInitialVisibility.current = initialColumnVisibility
        }
    }, [initialColumnVisibility, visibilityState])

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
        getExpandedRowModel: getExpandedRowModel(),
        getSubRows,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onExpandedChange: setExpanded,
        state: {
            sorting,
            columnFilters,
            globalFilter,
            columnVisibility,
            rowSelection,
            expanded,
        },
        initialState: {
            pagination: {
                pageSize: defaultPageSize,
            },
            columnVisibility: initialColumnVisibility,
            expanded: autoExpand ? true : {},
        },
    })

    const showToolbar = filterColumn || globalFilterFields || (facetedFilters && facetedFilters.length > 0) || toolbarAction || rightAction
    const selectedRows = table.getSelectedRowModel().rows

    if (cardMode) {
        const tableBody = isLoading ? (
            <TableRow className="hover:bg-transparent border-none">
                <TableCell
                    colSpan={columns.length}
                    className="p-6 pt-0 text-center"
                >
                    <SharedTableSkeleton rows={skeletonRows} columns={columns.length} className="pt-4" />
                </TableCell>
            </TableRow>
        ) : renderCustomView ? null : (
            table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                        <TableRow
                            data-state={row.getIsSelected() && "selected"}
                            className={cn(
                                "group border-b border-border/40 hover:bg-muted/50 transition-all",
                                onRowClick && "cursor-pointer",
                                row.getIsSelected() && "bg-primary/5"
                            )}
                            onClick={() => onRowClick?.(row.original)}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell 
                                    key={cell.id} 
                                    className="py-4"
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                        {row.getIsExpanded() && renderSubComponent && (
                            <TableRow>
                                <TableCell colSpan={row.getVisibleCells().length} className="p-0 bg-muted/30">
                                    {renderSubComponent(row)}
                                </TableCell>
                            </TableRow>
                        )}
                    </React.Fragment>
                ))
            ) : (
                <TableRow>
                    <TableCell
                        colSpan={columns.length}
                        className="h-24 p-0"
                    >
                        <EmptyState
                            context="search"
                            description="Intenta ajustar los filtros de búsqueda para encontrar lo que buscas."
                        />
                    </TableCell>
                </TableRow>
            )
        )


        return (
            <div className="relative space-y-1">
                {/* Toolbar Section (Outside) */}
                {showToolbar && (
                    <div className={cn("px-1", toolbarClassName)}>
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
                            viewOptions={viewOptions}
                            currentView={currentView}
                            onViewChange={onViewChange}
                            showColumnToggle={showColumnToggle}
                            customFilters={customFilters}
                            isCustomFiltered={isCustomFiltered}
                            customFilterCount={customFilterCount}
                            batchActions={batchActions && selectedRows.length > 0 ? (
                                <div className="flex items-center gap-3 bg-foreground text-background px-3 py-1.5 rounded-[0.25rem] shadow-sm border border-white/10 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex items-center gap-2 pr-3 border-r border-white/20">
                                        <div className="bg-primary p-0.5 rounded-full">
                                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                        </div>
                                        <span className="text-[10px] font-black font-heading uppercase tracking-wider">{selectedRows.length} Seleccionados</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 grayscale hover:grayscale-0 transition-all">
                                        {batchActions}
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => table.toggleAllRowsSelected(false)}
                                            className="h-6 w-6 hover:bg-white/10 text-white/50 hover:text-white rounded-[0.125rem]"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        />
                    </div>
                )}

                <div className="overflow-x-auto">
                    {renderCustomView ? (
                        <div className="py-0">{renderCustomView(table)}</div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-transparent">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow
                                        key={headerGroup.id}
                                        className="border-b-2 border-border/60 hover:bg-transparent"
                                    >
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="h-12"
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
                            {renderFooter && (
                                <TableFooter className="bg-muted/50 border-t-2">
                                    {renderFooter(table)}
                                </TableFooter>
                            )}
                        </Table>
                    )}
                </div>

                {/* Pagination Section (Outside) */}
                {!hidePagination && (
                    <div className="px-1">
                        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
                    </div>
                )}
            </div>
        )
    }

    // ─── Classic Mode (unchanged) ─────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {showToolbar && (
                <div className={toolbarClassName}>
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
                        viewOptions={viewOptions}
                        currentView={currentView}
                        onViewChange={onViewChange}
                        showColumnToggle={showColumnToggle}
                        customFilters={customFilters}
                        isCustomFiltered={isCustomFiltered}
                        customFilterCount={customFilterCount}
                        batchActions={batchActions && selectedRows.length > 0 ? (
                            <div className="flex items-center gap-2 bg-foreground text-background px-3 py-1 rounded-[0.25rem] shadow-sm text-xs font-bold font-heading uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-300">
                                <span>{selectedRows.length} Sel.</span>
                                <div className="mx-1 h-3 w-px bg-white/20" />
                                {batchActions}
                            </div>
                        ) : null}
                    />
                </div>
            )}
            {renderCustomView ? (
                renderCustomView(table)
            ) : (
                <div className={cn(!noBorder && "rounded-md border")}>
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
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell
                                        colSpan={columns.length}
                                        className="p-6 pt-0"
                                    >
                                        <SharedTableSkeleton rows={skeletonRows} columns={columns.length} className="pt-4" />
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <React.Fragment key={row.id}>
                                        <TableRow
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
                                        {row.getIsExpanded() && renderSubComponent && (
                                            <TableRow>
                                                <TableCell colSpan={row.getVisibleCells().length} className="p-0 border-b border-border/50">
                                                    {renderSubComponent(row)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 p-0"
                                    >
                                        <EmptyState
                                            icon={SearchX}
                                            title="No se encontraron resultados"
                                            description="Intenta ajustar los filtros de búsqueda para encontrar lo que buscas."
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        {renderFooter && (
                            <TableFooter className="bg-muted/50 border-t-2 font-mono">
                                {renderFooter(table)}
                            </TableFooter>
                        )}
                    </Table>
                </div>
            )}
            {!hidePagination && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
        </div>
    )
}
