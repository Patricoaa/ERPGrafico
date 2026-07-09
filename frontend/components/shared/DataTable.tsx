"use client"

import * as React from "react"
import {
    type ColumnDef,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFacetedUniqueValues,
    getFacetedRowModel,
    useReactTable,
    getExpandedRowModel,
    type Row,
    type RowSelectionState,
    type Table as ReactTable,
} from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"

import { cn } from "@/lib/utils"


import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { X, type LucideIcon } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

import { BulkActionButtons, ActionDock, CmykRing, DataTablePagination, DataTableToolbar, EmptyState, SkeletonShell, StatCard, type BulkAction, type AnalyticsPanelConfig, type ToolbarActionItem } from '@/components/shared'
import { resolveEmptyState, type DataTableEmptyState } from './emptyStateResolver'

export interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    defaultPageSize?: number
    pageSizeOptions?: number[]
    hideToolbar?: boolean
    /** Items de acciones secundarias agrupadas en dropdown "Acciones". */
    toolbarActions?: ToolbarActionItem[]
    onRowSelectionChange?: (selection: RowSelectionState) => void
    initialColumnVisibility?: VisibilityState
    hiddenColumns?: string[]
    onReset?: () => void
    renderCustomView?: (table: ReactTable<TData>) => React.ReactNode
    smartSearch?: React.ReactNode
    segmentation?: React.ReactNode
    unifiedSearch?: React.ReactNode
    showReset?: boolean
    sortOptions?: boolean
    analyticsPanel?: AnalyticsPanelConfig
    onRowClick?: (row: TData) => void
    /** Layout variant. Use 'embedded' when the table lives inside a card/panel (no outer border, compact toolbar). Use 'standalone' for full-page tables with border. Use 'minimal' for simple display tables inside tabs/detail panels (no toolbar, no pagination). Use 'compact' for dense CSS Grid tables inside modals/drawers (no toolbar, no pagination, no border). */
    variant?: 'standalone' | 'embedded' | 'minimal' | 'compact'
    /** CSS Grid template class for compact variant. Required when variant='compact'. Example: "grid-cols-[2rem_1fr_auto_auto_auto]" */
    gridTemplate?: string
    /** Gap between columns in compact variant. Default: "gap-x-3" */
    gridGap?: string
    /** Max height for the compact variant ScrollArea. Default: "max-h-[65vh]" */
    compactMaxHeight?: string
    /** Render callback for the actions cell in compact variant. Receives the row data and returns a ReactNode. Occupies the last grid track. */
    renderRowActions?: (row: TData) => React.ReactNode
    isLoading?: boolean
    isRefetching?: boolean
    skeletonRows?: number
    renderSubComponent?: (row: Row<TData>) => React.ReactNode
    hidePagination?: boolean
    toolbarClassName?: string
    noBorder?: boolean
    /**
     * Declarative bulk actions rendered in a floating ActionDock when
     * one or more rows are selected. For custom layouts (stats, dropdowns)
     * use `bulkDock` instead.
     */
    bulkActions?: BulkAction<TData>[]
    /**
     * Escape hatch: full control over the floating dock. Receives the
     * selected items and a `clear` callback. Renders inside ActionDock.
     */
    bulkDock?: (items: TData[], clear: () => void) => React.ReactNode
    viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
    currentView?: string
    onViewChange?: (view: string) => void
    columnToggle?: boolean
    renderFooter?: (table: ReactTable<TData>) => React.ReactNode
    getSubRows?: (originalRow: TData, index: number) => TData[] | undefined
    autoExpand?: boolean
    initialColumnFilters?: { id: string; value: unknown }[]
    initialSorting?: SortingState
    /** Primary create action rendered at the right-most end of the toolbar, after the button group */
    createAction?: React.ReactNode
    /**
     * Empty-state copy. Flat fields describe the "no records at all" case
     * (entity truly empty). The optional `filtered` sub-object overrides the
     * "active search/filter returned nothing" case; sensible defaults are
     * applied when omitted. Which one renders is driven by `isFiltered`.
     */
    emptyState?: DataTableEmptyState
    /**
     * Signals that the current empty result is the product of an active
     * toolbar search/filter. Drives the empty-state copy:
     *  - `true`      → "No se encontraron resultados" (filtered)
     *  - `false`     → entity-specific "sin registros" (no records at all)
     *  - `undefined` → legacy single empty-state (back-compat, no distinction)
     * Wire it from `useSmartSearch().isFiltered`.
     */
    isFiltered?: boolean
    renderRow?: (row: Row<TData>, children: React.ReactNode) => React.ReactNode
    /** Callback to compute a CSS class name for each row. Receives the full TanStack Row object. */
    getRowClassName?: (row: Row<TData>) => string
    manualPagination?: boolean
    pageCount?: number
    /**
     * Server-side total. REQUIRED when `manualPagination` is true so the
     * pagination footer can show the real count instead of the current
     * page's row count. See docs/20-contracts/pagination-contract.md §3.2.
     */
    rowCount?: number
    pagination?: { pageIndex: number; pageSize: number }
    onPaginationChange?: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
    rowSelection?: RowSelectionState
    renderLoadingView?: () => React.ReactNode
    kpiCards?: KpiCardDef[]
}

export interface KpiCardDef {
    label: string
    value: React.ReactNode
    icon?: LucideIcon
    accent?: "primary" | "info" | "success" | "warning" | "destructive" | "accent" | "muted"
    subtext?: string
    variant?: "default" | "compact" | "minimal" | "fill" | "chart" | "metric-chart"
    className?: string
}

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {}
const EMPTY_ARRAY: never[] = []
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500]
function getSkeletonCellContent(columnIndex: number, totalColumns: number): { width: string; height: string; shape: 'bar' | 'pill' | 'icon' | 'code' } {
    if (columnIndex === totalColumns - 1) {
        return { width: 'w-8', height: 'h-4', shape: 'icon' }
    }
    if (columnIndex === 0) {
        return { width: 'w-16', height: 'h-4', shape: 'code' }
    }
    if (columnIndex % 3 === 2) {
        return { width: 'w-20', height: 'h-4', shape: 'pill' }
    }
    const widths = ['w-3/4', 'w-3/5', 'w-2/5', 'w-4/5', 'w-1/2', 'w-7/10', 'w-1/3']
    return { width: widths[columnIndex % widths.length], height: 'h-4', shape: 'bar' }
}

export function DataTable<TData, TValue>({
    columns,
    data,
    defaultPageSize = 20,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    hideToolbar = false,
    toolbarActions,
    onRowSelectionChange,
    initialColumnVisibility = DEFAULT_COLUMN_VISIBILITY,
    hiddenColumns = EMPTY_ARRAY,
    onReset,
    renderCustomView,
    smartSearch,
    segmentation,
    unifiedSearch,
    showReset,
    sortOptions,
    analyticsPanel,
    onRowClick,
    variant,
    isLoading = false,
    isRefetching = false,
    skeletonRows,
    renderSubComponent,
    hidePagination = false,
    toolbarClassName,
    noBorder = false,
    bulkActions,
    bulkDock,
    viewOptions,
    currentView,
    onViewChange,
    columnToggle,
    renderFooter,
    getSubRows,
    autoExpand,
    createAction,
    emptyState: customEmptyState,
    isFiltered,
    initialColumnFilters = EMPTY_ARRAY,
    initialSorting,
    renderRow,
    getRowClassName,
    manualPagination,
    pageCount,
    rowCount,
    pagination,
    onPaginationChange,
    rowSelection,
    renderLoadingView,
    kpiCards,
    gridTemplate,
    gridGap = "gap-x-3",
    compactMaxHeight = "max-h-[65vh]",
    renderRowActions,
}: DataTableProps<TData, TValue>) {
    const isEmbedded = variant === 'embedded'
    const isMinimal = variant === 'minimal'
    const isCompact = variant === 'compact'
    const effectiveSkeletonRows = skeletonRows ?? defaultPageSize
    const emptyProps = resolveEmptyState(customEmptyState, isFiltered)

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
        autoResetPageIndex: false,
        autoResetExpanded: false,
        initialState: {
            pagination: pagination ? undefined : {
                pageSize: defaultPageSize,
            },
            columnVisibility: initialVisibility,
            expanded: autoExpand ? true : {},
            columnFilters: initialColumnFilters,
            sorting: initialSorting,
        },
        // IMPORTANT: pasar `onPaginationChange: undefined` sobrescribe el default
        // `makeStateUpdater('pagination', table)` de TanStack v8 (merge por spread
        // en core/table.ts), convirtiendo `setPageSize`/`setPageIndex` en no-ops.
        // Solo incluir cuando el consumidor realmente provee un callback.
        ...(onPaginationChange ? { onPaginationChange } : {}),
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

    const showToolbar = !hideToolbar && !isMinimal && !isCompact && (
        smartSearch ||
        segmentation ||
        (toolbarActions && toolbarActions.length > 0) ||
        createAction ||
        (viewOptions && viewOptions.length > 0) ||
        sortOptions ||
        analyticsPanel ||
        columnToggle ||
        !!currentView
    )
    const selectedRows = table.getSelectedRowModel().rows
    const selectedItems = React.useMemo(() => selectedRows.map(r => r.original), [selectedRows])
    const clearSelection = React.useCallback(() => table.resetRowSelection(), [table])

    const dockNode = (() => {
        if (selectedRows.length === 0) return null
        if (bulkDock) return (
            <ActionDock isVisible>
                <div className="flex items-center gap-2">
                    <CmykRing className="h-2.5 w-2.5 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap">
                        {`${selectedRows.length} ${selectedRows.length === 1 ? "seleccionado" : "seleccionados"}`}
                    </span>
                </div>
                {bulkDock(selectedItems, clearSelection)}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted"
                >
                    <X className="h-3 w-3 mr-1.5" />
                    Limpiar
                </Button>
            </ActionDock>
        )
        if (bulkActions && bulkActions.length > 0) {
            return (
                <ActionDock isVisible>
                    <div className="flex items-center gap-2">
                        <CmykRing className="h-2.5 w-2.5 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap">
                            {`${selectedRows.length} ${selectedRows.length === 1 ? "seleccionado" : "seleccionados"}`}
                        </span>
                    </div>
                    <BulkActionButtons actions={bulkActions} items={selectedItems} />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted"
                    >
                        <X className="h-3 w-3 mr-1.5" />
                        Limpiar
                    </Button>
                </ActionDock>
            )
        }
        return null
    })()

    const kpiCardsNode = kpiCards && (
        <div className="grid gap-4 md:grid-cols-4">
            {kpiCards.map((card, i) => (
                <StatCard key={i} {...card} loading={isLoading} />
            ))}
        </div>
    )

    // ─── Loading state (unified) ────────────────────────────────────────
    if (isLoading) {
        return (
            <div ref={containerRef} className={cn(
                isEmbedded && "relative flex flex-col h-full w-full space-y-1 min-h-0",
                !isEmbedded && !isMinimal && "w-full space-y-4",
                isMinimal && "space-y-0"
            )}>
                {kpiCardsNode}

                {showToolbar && !isMinimal && (
                    <DataTableToolbar
                        table={table}
                        toolbarActions={toolbarActions}
                        onReset={onReset}
                        sortOptions={sortOptions}
                        viewOptions={viewOptions}
                        currentView={currentView}
                        onViewChange={onViewChange}
                        columnToggle={columnToggle}
                        smartSearch={smartSearch}
                        segmentation={segmentation}
                        unifiedSearch={unifiedSearch}
                        showReset={showReset}
                        analyticsPanel={analyticsPanel}
                        createAction={createAction}
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
                                                <TableHead key={header.id} className="table-header">
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
                                    {Array.from({ length: effectiveSkeletonRows }, (_, i) => (
                                        <TableRow key={`skel-${i}`} className="border-b border-border/40">
                                            {columns.map((_, j) => {
                                                const cell = getSkeletonCellContent(j, columns.length)
                                                return (
                                                    <TableCell key={`skel-${i}-${j}`} className="table-cell">
                                                        <Skeleton
                                                            className={cn(
                                                                cell.height,
                                                                cell.width,
                                                                cell.shape === 'pill' && 'rounded-full',
                                                                cell.shape === 'icon' && 'rounded-md',
                                                                cell.shape === 'code' && 'mx-auto',
                                                            )}
                                                        />
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </SkeletonShell>
                    </div>
                )}

                {!hidePagination && !isMinimal && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
            </div>
        )
    }

    // ─── Minimal mode ────────────────────────────────────────────────────
    if (isMinimal) {
        return (
            <div ref={containerRef} className={cn(
                "relative",
                !noBorder && "rounded-md border"
            )}>
                <Table>
                    <TableHeader className="bg-muted/30">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="table-header">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={cn(
                                        "table-row-hover border-b border-border/40",
                                        onRowClick && "cursor-pointer",
                                        getRowClassName?.(row)
                                    )}
                                    onClick={() => onRowClick?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="table-cell">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={columns.length} className="h-24 p-0">
                                    <EmptyState
                                        context={emptyProps.context}
                                        icon={emptyProps.icon}
                                        title={emptyProps.title}
                                        description={emptyProps.description}
                                        action={emptyProps.action}
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    {renderFooter && (
                        <TableFooter className="table-footer">
                            {renderFooter(table)}
                        </TableFooter>
                    )}
                </Table>
            </div>
        )
    }

    // ─── Compact Mode (CSS Grid for modals/drawers) ────────────────────────
    if (isCompact) {
        const effectiveGridTemplate = gridTemplate ?? ''

        if (process.env.NODE_ENV === 'development' && !gridTemplate) {
            console.warn('[DataTable] variant="compact" requires a gridTemplate prop. Example: gridTemplate="grid-cols-[2rem_1fr_auto_auto_auto]"')
        }

        if (isLoading) {
            return (
                <div ref={containerRef} className="relative">
                    <div className={cn("grid", effectiveGridTemplate, gridGap)}>
                        <div className={cn("grid grid-cols-subgrid col-span-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b")}>
                            {table.getHeaderGroups()[0]?.headers.map((header) => (
                                <div key={header.id} className="text-center">
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </div>
                            ))}
                            {renderRowActions && <div />}
                        </div>
                        {Array.from({ length: effectiveSkeletonRows }, (_, i) => (
                            <div key={`skel-${i}`} className={cn("grid grid-cols-subgrid col-span-full items-center px-3 py-2.5 border-b border-border/60 last:border-b-0")}>
                                {columns.map((_, j) => (
                                    <div key={`skel-${i}-${j}`} className="flex justify-center">
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                ))}
                                {renderRowActions && <div />}
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        return (
            <div ref={containerRef} className="relative">
                {table.getRowModel().rows?.length ? (
                    <ScrollArea className={compactMaxHeight}>
                        <div className={cn("grid", effectiveGridTemplate, gridGap)}>
                            {/* Header */}
                            <div className={cn("grid grid-cols-subgrid col-span-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b sticky top-0 bg-card z-10")} role="row">
                                {table.getHeaderGroups()[0]?.headers.map((header) => (
                                    <div key={header.id} role="columnheader">
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </div>
                                ))}
                                {renderRowActions && <div role="columnheader" />}
                            </div>
                            {/* Body */}
                            {table.getRowModel().rows.map((row) => (
                                <div
                                    key={row.id}
                                    role="row"
                                    className={cn(
                                        "grid grid-cols-subgrid col-span-full",
                                        "items-center px-3 py-2.5 hover:bg-muted/40 transition-all group animate-in fade-in duration-300 border-b border-border/60 last:border-b-0",
                                        onRowClick && "cursor-pointer",
                                        getRowClassName?.(row)
                                    )}
                                    onClick={() => onRowClick?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <div key={cell.id} role="cell">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </div>
                                    ))}
                                    {renderRowActions && (
                                        <div role="cell" className="flex items-center gap-1 justify-end">
                                            {renderRowActions(row.original)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <EmptyState
                        context={emptyProps.context}
                        icon={emptyProps.icon}
                        title={emptyProps.title}
                        description={emptyProps.description}
                        action={emptyProps.action}
                    />
                )}
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
                                        "group border-b border-border/40 table-row-hover transition-all",
                                        onRowClick && "cursor-pointer",
                                        row.getIsSelected() && "bg-primary/5",
                                        getRowClassName?.(row)
                                    )}
                                    onClick={() => onRowClick?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className="table-cell"
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
                                    "group border-b border-border/40 table-row-hover transition-all",
                                    onRowClick && "cursor-pointer",
                                    row.getIsSelected() && "bg-primary/5",
                                    getRowClassName?.(row)
                                )}
                                onClick={() => onRowClick?.(row.original)}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        className="table-cell"
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        )}
                        {row.getIsExpanded() && renderSubComponent && (
                            <tr key={`exp-${row.id}`} className="animate-in fade-in slide-in-from-top-2 duration-200 ease-in-out fill-mode-both">
                                <TableCell colSpan={row.getVisibleCells().length} className="p-0" style={{ backgroundColor: 'var(--table-expanded-bg)' }}>
                                    {renderSubComponent(row)}
                                </TableCell>
                            </tr>
                        )}
                    </React.Fragment>
                ))
            ) : (
                <TableRow className="hover:bg-transparent">
                    <TableCell
                        colSpan={columns.length}
                        className="h-full p-0 align-middle"
                    >
                        <EmptyState
                            context={emptyProps.context}
                            icon={emptyProps.icon}
                            title={emptyProps.title}
                            description={emptyProps.description}
                            action={emptyProps.action}
                            className="h-full w-full"
                        />
                    </TableCell>
                </TableRow>
            )
        )

        // When empty, stretch the table to fill the scroll container so the
        // single empty-state row expands to the full available height/width
        // of the canvas instead of collapsing to its content.
        const isTableEmpty = !renderCustomView && table.getRowModel().rows.length === 0

        return (
            <div ref={containerRef} className="relative flex flex-col h-full w-full space-y-1 min-h-0">
                {/* Toolbar Section (Outside) */}
                {kpiCardsNode}

                {showToolbar && (
                    <div className={cn(
                        "w-full shrink-0",
                        !isInModal && "sticky top-0 z-20 bg-transparent py-2",
                        toolbarClassName
                    )}>
                        <DataTableToolbar
                            table={table}
                            toolbarActions={toolbarActions}
                            onReset={onReset}
                            sortOptions={sortOptions}
                            viewOptions={viewOptions}
                            currentView={currentView}
                            onViewChange={onViewChange}
                            columnToggle={columnToggle}
                            smartSearch={smartSearch}
                            segmentation={segmentation}
                            unifiedSearch={unifiedSearch}
                            showReset={showReset}
                            analyticsPanel={analyticsPanel}
                            createAction={createAction}
                        />
                    </div>
                )}

                <div className={cn("flex-1 min-h-0", renderCustomView ? "overflow-y-scroll custom-scrollbar overflow-x-auto" : "flex flex-col overflow-hidden")}>
                    {renderCustomView ? (
                        <div className="py-0">
                            {renderCustomView(table)}
                        </div>
                    ) : (
                        <Table
                            className={cn(isTableEmpty && "h-full")}
                            containerClassName={cn(
                                !isInModal && "flex-1 overflow-y-scroll custom-scrollbar"
                            )}
                        >
                            <TableHeader className={cn(!isInModal ? "sticky top-0 bg-card z-10 border-b-2" : "sticky top-0 bg-card z-10 border-b-2")}>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow
                                        key={headerGroup.id}
                                        className="border-none hover:bg-transparent"
                                    >
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="table-header"
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
                                <TableFooter className="table-footer border-t-2">
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
        <div ref={containerRef} className="w-full space-y-4">
            {kpiCardsNode}
            {showToolbar && (
                <div className={cn(
                    "w-full",
                    !isInModal && "sticky top-0 z-20 bg-transparent py-2",
                    toolbarClassName
                )}>
                    <DataTableToolbar
                        table={table}
                        toolbarActions={toolbarActions}
                        onReset={onReset}
                        sortOptions={sortOptions}
                        viewOptions={viewOptions}
                        currentView={currentView}
                        onViewChange={onViewChange}
                        columnToggle={columnToggle}
                        smartSearch={smartSearch}
                        segmentation={segmentation}
                        unifiedSearch={unifiedSearch}
                        showReset={showReset}
                        analyticsPanel={analyticsPanel}
                        createAction={createAction}
                    />
                </div>
            )}
            {renderCustomView ? (
                renderCustomView(table)
            ) : (
                <div className={cn("relative", !noBorder && "rounded-md border")}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden pointer-events-none">
                        <div
                            className={cn(
                                "h-full bg-primary origin-left transition-transform duration-300 ease-in-out",
                                isRefetching ? "scale-x-100" : "scale-x-0"
                            )}
                        />
                    </div>
                    <Table containerClassName={cn(
                        !isInModal && "max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar"
                    )}>
                        <TableHeader className={cn(!isInModal ? "sticky top-0 bg-background z-10 shadow-card border-b" : "bg-muted/30")}>
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
                                                        "group table-row-hover",
                                                        onRowClick && "cursor-pointer",
                                                        getRowClassName?.(row)
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
                                                    "group table-row-hover",
                                                    onRowClick && "cursor-pointer",
                                                    getRowClassName?.(row)
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
                                            <tr key={`exp-${row.id}`} className="animate-in fade-in slide-in-from-top-2 duration-200 ease-in-out fill-mode-both">
                                                <TableCell colSpan={row.getVisibleCells().length} className="p-0 border-b border-border/50">
                                                    {renderSubComponent(row)}
                                                </TableCell>
                                            </tr>
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
                                            context={emptyProps.context}
                                            icon={emptyProps.icon}
                                            title={emptyProps.title}
                                            description={emptyProps.description}
                                            action={emptyProps.action}
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        {renderFooter && (
                            <TableFooter className="table-footer border-t-2">
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
