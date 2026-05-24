"use client"

import * as React from "react"
import {
    ColumnDef,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFacetedUniqueValues,
    getFacetedRowModel,
    useReactTable,
    getExpandedRowModel,
    Row,
    RowSelectionState,
    Table as ReactTable,
} from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { SkeletonShell } from "@/components/shared/SkeletonShell"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { SearchX, LucideIcon } from "lucide-react"
import { EmptyStateContext } from "@/components/shared/EmptyState"
import { BulkActionDock, BulkActionButtons, type BulkAction } from "@/components/shared"

import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { DataTableToolbar } from "@/components/shared/DataTableToolbar"

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
            icon?: LucideIcon
        }[]
    }[]
    toolbarAction?: React.ReactNode
    onRowSelectionChange?: (selection: RowSelectionState) => void
    initialColumnVisibility?: VisibilityState
    hiddenColumns?: string[]
    useAdvancedFilter?: boolean
    onReset?: () => void
    renderCustomView?: (table: ReactTable<TData>) => React.ReactNode
    leftAction?: React.ReactNode
    rightAction?: React.ReactNode
    showToolbarSort?: boolean
    onRowClick?: (row: TData) => void
    /** Layout variant. Use 'embedded' when the table lives inside a card/panel (no outer border, compact toolbar). Use 'standalone' for full-page tables with border. */
    variant?: 'standalone' | 'embedded'
    isLoading?: boolean
    skeletonRows?: number
    renderSubComponent?: (row: Row<TData>) => React.ReactNode
    hidePagination?: boolean
    toolbarClassName?: string
    noBorder?: boolean
    /**
     * Declarative bulk actions rendered in a floating BulkActionDock when
     * one or more rows are selected. For custom layouts (stats, dropdowns)
     * use `bulkDock` instead.
     */
    bulkActions?: BulkAction<TData>[]
    /**
     * Escape hatch: full control over the floating dock. Receives the
     * selected items and a `clear` callback. Wraps content with
     * `BulkActionDock` to keep visual consistency.
     */
    bulkDock?: (items: TData[], clear: () => void) => React.ReactNode
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
    initialColumnFilters?: { id: string; value: unknown }[]
    /** Primary create action rendered at the right-most end of the toolbar, after the button group */
    createAction?: React.ReactNode
    /** Custom actions/buttons rendered inside the main toolbar button group */
    rightButtonGroupAction?: React.ReactNode
    emptyState?: {
        title?: string
        description?: string
        icon?: LucideIcon
        action?: React.ReactNode
        context?: EmptyStateContext
    }
    renderRow?: (row: Row<TData>, children: React.ReactNode) => React.ReactNode
    manualPagination?: boolean
    pageCount?: number
    /**
     * Server-side total. REQUIRED when `manualPagination` is true so the
     * pagination footer can show the real count instead of the current
     * page's row count. See docs/20-contracts/pagination-contract.md §3.2.
     */
    rowCount?: number
    pagination?: { pageIndex: number; pageSize: number }
    onPaginationChange?: (updater: any) => void
    rowSelection?: RowSelectionState
    renderLoadingView?: () => React.ReactNode
}

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {}
const EMPTY_ARRAY: any[] = []
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500]

export function DataTable<TData, TValue>({
    columns,
    data,
    defaultPageSize = 20,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    filterColumn,
    searchPlaceholder,
    globalFilterFields,
    facetedFilters,
    toolbarAction,
    onRowSelectionChange,
    initialColumnVisibility = DEFAULT_COLUMN_VISIBILITY,
    hiddenColumns = EMPTY_ARRAY,
    useAdvancedFilter = false,
    onReset,
    renderCustomView,
    leftAction,
    rightAction,
    showToolbarSort,
    onRowClick,
    variant,
    isLoading = false,
    skeletonRows = 5,
    renderSubComponent,
    hidePagination = false,
    toolbarClassName,
    noBorder = false,
    bulkActions,
    bulkDock,
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
    createAction,
    rightButtonGroupAction,
    emptyState: customEmptyState,
    initialColumnFilters = EMPTY_ARRAY,
    renderRow,
    manualPagination,
    pageCount,
    rowCount,
    pagination,
    onPaginationChange,
    rowSelection,
    renderLoadingView,
}: DataTableProps<TData, TValue>) {
    const isEmbedded = variant === 'embedded'

    const containerRef = React.useRef<HTMLDivElement>(null)
    const [isInModal, setIsInModal] = React.useState(false)

    React.useEffect(() => {
        if (containerRef.current) {
            const hasDialogParent = !!containerRef.current.closest('[role="dialog"]') ||
                !!containerRef.current.closest('.dialog') ||
                !!containerRef.current.closest('[data-state*="open"]') ||
                !!containerRef.current.closest('.modal');
            setIsInModal(hasDialogParent)
        }
    }, [])

    // Uncontrolled mode: let TanStack Table manage sorting/filters/visibility/
    // expansion/selection state internally. Previous controlled-state wiring
    // triggered React 19's "state update on a component that hasn't mounted
    // yet" warning because TanStack syncs controlled state during render.
    // For prop-driven column visibility changes we imperatively call
    // `table.setColumnVisibility` in an effect (post-mount).
    const initialVisibility = React.useMemo<VisibilityState>(() => {
        const visibility = { ...initialColumnVisibility }
        hiddenColumns.forEach(col => {
            visibility[col] = false
        })
        return visibility
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
        manualPagination,
        pageCount,
        rowCount,
        onPaginationChange,
        autoResetPageIndex: false,
        autoResetExpanded: false,
        initialState: {
            pagination: pagination ? undefined : {
                pageSize: defaultPageSize,
            },
            columnVisibility: initialVisibility,
            expanded: autoExpand ? true : {},
            columnFilters: initialColumnFilters,
        },
        ...(pagination ? { state: { pagination } } : {})
    })

    // Sync prop-driven column visibility after mount.
    const prevInitialVisibility = React.useRef(initialColumnVisibility)
    const prevHiddenColumns = React.useRef(hiddenColumns)
    React.useEffect(() => {
        const visibilityChanged = JSON.stringify(prevInitialVisibility.current) !== JSON.stringify(initialColumnVisibility)
        const hiddenChanged = JSON.stringify(prevHiddenColumns.current) !== JSON.stringify(hiddenColumns)

        if (visibilityChanged || hiddenChanged) {
            const newVisibility = { ...initialColumnVisibility }
            hiddenColumns.forEach(col => {
                newVisibility[col] = false
            })
            table.setColumnVisibility(newVisibility)
            prevInitialVisibility.current = initialColumnVisibility
            prevHiddenColumns.current = hiddenColumns
        }
    }, [initialColumnVisibility, hiddenColumns, table])

    // Sync prop-driven row selection after mount.
    const prevRowSelectionProp = React.useRef(rowSelection)
    React.useEffect(() => {
        if (rowSelection !== undefined && JSON.stringify(prevRowSelectionProp.current) !== JSON.stringify(rowSelection)) {
            table.setRowSelection(rowSelection)
            prevRowSelectionProp.current = rowSelection
        }
    }, [rowSelection, table])

    // Fire parent row-selection callback when TanStack's internal rowSelection changes.
    const internalRowSelection = table.getState().rowSelection
    const prevInternalRowSelection = React.useRef(internalRowSelection)
    React.useEffect(() => {
        if (JSON.stringify(prevInternalRowSelection.current) !== JSON.stringify(internalRowSelection)) {
            prevInternalRowSelection.current = internalRowSelection
            onRowSelectionChange?.(internalRowSelection)
        }
    }, [internalRowSelection, onRowSelectionChange])

    const showToolbar = filterColumn || globalFilterFields || (facetedFilters && facetedFilters.length > 0) || toolbarAction || rightAction || leftAction || createAction || (viewOptions && viewOptions.length > 0) || showToolbarSort
    const selectedRows = table.getSelectedRowModel().rows
    const selectedItems = React.useMemo(() => selectedRows.map(r => r.original), [selectedRows])
    const clearSelection = React.useCallback(() => table.resetRowSelection(), [table])

    const dockNode = (() => {
        if (selectedRows.length === 0) return null
        if (bulkDock) return bulkDock(selectedItems, clearSelection)
        if (bulkActions && bulkActions.length > 0) {
            return (
                <BulkActionDock selectedCount={selectedRows.length} onClear={clearSelection}>
                    <BulkActionButtons actions={bulkActions} items={selectedItems} />
                </BulkActionDock>
            )
        }
        return null
    })()

    // ─── Loading state (unified) ────────────────────────────────────────
    if (isLoading) {
        return (
            <div ref={containerRef} className={isEmbedded ? "relative flex flex-col h-full space-y-1 min-h-0" : "space-y-4"}>
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
                        leftAction={leftAction}
                        rightAction={rightAction}
                        showToolbarSort={showToolbarSort}
                        viewOptions={viewOptions}
                        currentView={currentView}
                        onViewChange={onViewChange}
                        showColumnToggle={showColumnToggle}
                        customFilters={customFilters}
                        isCustomFiltered={isCustomFiltered}
                        customFilterCount={customFilterCount}
                        createAction={createAction}
                        rightButtonGroupAction={rightButtonGroupAction}
                    />
                )}

                {renderLoadingView ? (
                    renderLoadingView()
                ) : (
                    <div className={cn(!noBorder && !isEmbedded && "rounded-md border")}>
                        <SkeletonShell isLoading ariaLabel="Cargando tabla">
                            <Table>
                                <TableHeader>
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <TableRow key={headerGroup.id}>
                                            {headerGroup.headers.map(header => (
                                                <TableHead key={header.id} className="h-12">
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
                                    {Array.from({ length: skeletonRows }, (_, i) => (
                                        <TableRow key={`skel-${i}`} className="border-b border-border/40">
                                            {columns.map((_, j) => (
                                                <TableCell key={`skel-${i}-${j}`} className="py-4" />
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </SkeletonShell>
                    </div>
                )}

                {!hidePagination && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
            </div>
        )
    }

    if (isEmbedded) {
        const tableBody = renderCustomView ? null : (
            table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                        {renderRow ? (
                            renderRow(row, (
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
                            ))
                        ) : (
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
                        )}
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
                            context={customEmptyState?.context || "search"}
                            title={customEmptyState?.title}
                            description={customEmptyState?.description || "Intenta ajustar los filtros de búsqueda para encontrar lo que buscas."}
                            icon={customEmptyState?.icon}
                            action={customEmptyState?.action}
                        />
                    </TableCell>
                </TableRow>
            )
        )


        return (
            <div ref={containerRef} className="relative flex flex-col h-full space-y-1 min-h-0">
                {/* Toolbar Section (Outside) */}
                {showToolbar && (
                    <div className={cn(
                        "px-1 shrink-0",
                        !isInModal && "sticky top-0 z-20 bg-transparent py-2",
                        toolbarClassName
                    )}>
                        <DataTableToolbar
                            table={table}
                            filterColumn={filterColumn}
                            globalFilterFields={globalFilterFields}
                            searchPlaceholder={searchPlaceholder}
                            facetedFilters={facetedFilters}
                            toolbarAction={toolbarAction}
                            useAdvancedFilter={useAdvancedFilter}
                            onReset={onReset}
                            leftAction={leftAction}
                            rightAction={rightAction}
                            showToolbarSort={showToolbarSort}
                            viewOptions={viewOptions}
                            currentView={currentView}
                            onViewChange={onViewChange}
                            showColumnToggle={showColumnToggle}
                            customFilters={customFilters}
                            isCustomFiltered={isCustomFiltered}
                            customFilterCount={customFilterCount}
                            createAction={createAction}
                            rightButtonGroupAction={rightButtonGroupAction}
                        />
                    </div>
                )}

                <div className={cn("flex-1 min-h-0", renderCustomView ? "overflow-x-auto" : "flex flex-col overflow-hidden")}>
                    {renderCustomView ? (
                        <div className="py-0 h-full overflow-y-scroll custom-scrollbar">
                            {renderCustomView(table)}
                        </div>
                    ) : (
                        <Table containerClassName={cn(
                            !isInModal && "flex-1 overflow-y-scroll custom-scrollbar"
                        )}>
                            <TableHeader className={cn(!isInModal ? "sticky top-0 bg-card z-10 border-b" : "bg-transparent")}>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow
                                        key={headerGroup.id}
                                        className="border-none hover:bg-transparent"
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
                    <div className="px-1 shrink-0 border-t border-border/40 py-1">
                        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
                    </div>
                )}

                {dockNode}
            </div>
        )
    }

    // ─── Classic Mode (unchanged) ─────────────────────────────────────────────
    return (
        <div ref={containerRef} className="space-y-4">
            {showToolbar && (
                <div className={cn(
                    !isInModal && "sticky top-0 z-20 bg-transparent py-2",
                    toolbarClassName
                )}>
                    <DataTableToolbar
                        table={table}
                        filterColumn={filterColumn}
                        globalFilterFields={globalFilterFields}
                        searchPlaceholder={searchPlaceholder}
                        facetedFilters={facetedFilters}
                        toolbarAction={toolbarAction}
                        useAdvancedFilter={useAdvancedFilter}
                        onReset={onReset}
                        leftAction={leftAction}
                        rightAction={rightAction}
                        showToolbarSort={showToolbarSort}
                        viewOptions={viewOptions}
                        currentView={currentView}
                        onViewChange={onViewChange}
                        showColumnToggle={showColumnToggle}
                        customFilters={customFilters}
                        isCustomFiltered={isCustomFiltered}
                        customFilterCount={customFilterCount}
                        createAction={createAction}
                        rightButtonGroupAction={rightButtonGroupAction}
                    />
                </div>
            )}
            {renderCustomView ? (
                renderCustomView(table)
            ) : (
                <div className={cn(!noBorder && "rounded-md border")}>
                    <Table containerClassName={cn(
                        !isInModal && "max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar"
                    )}>
                        <TableHeader className={cn(!isInModal ? "sticky top-0 bg-background z-10 shadow-sm border-b" : "bg-muted/30")}>
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
                                    <React.Fragment key={row.id}>
                                        {renderRow ? (
                                            renderRow(row, (
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
                                            ))
                                        ) : (
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
                                        )}
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
                                            context={customEmptyState?.context || "search"}
                                            icon={customEmptyState?.icon || SearchX}
                                            title={customEmptyState?.title || "No se encontraron resultados"}
                                            description={customEmptyState?.description || "Intenta ajustar los filtros de búsqueda para encontrar lo que buscas."}
                                            action={customEmptyState?.action}
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
            {dockNode}
        </div>
    )
}
