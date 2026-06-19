"use client"

import React, { useState, useMemo } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, X, LayoutDashboard } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnalyticsPanel, type AnalyticsTab, type Granularity } from "./AnalyticsPanel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableFacetedFilter } from "./DataTableFacetedFilter"
import { DataTableColumnToggle, translateColumnId } from "./DataTableColumnToggle"

interface DataTableToolbarProps<TData> {
    table: Table<TData>
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
    onReset?: () => void
    sortOptions?: boolean
    viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
    currentView?: string
    onViewChange?: (view: string) => void
    columnToggle?: boolean
    customFilters?: React.ReactNode
    smartSearch?: React.ReactNode
    analyticsPanel?: AnalyticsPanelConfig
    createAction?: React.ReactNode
}

export type AnalyticsPanelConfig = {
    onClick?: () => void
    screen?: {
        entityName: string
        tabs: AnalyticsTab[]
        activeTab?: string
        onTabChange?: (value: string) => void
        granularity?: Granularity
        onGranularityChange?: (g: Granularity) => void
        dateRange?: { from: string; to: string } | null
        onDateRangeChange?: (range: { from: string; to: string } | null) => void
        cardAccounts?: Array<{ id: number; name: string; currency: string }>
        cardAccountId?: number | null
        onCardAccountChange?: (id: number) => void
        scope?: 'month' | 'all'
        onScopeChange?: (scope: 'month' | 'all') => void
    }
}

export function DataTableToolbar<TData>(props: DataTableToolbarProps<TData>) {
    const {
        table,
        facetedFilters = [],
        toolbarAction,
        onReset,
        sortOptions = false,
        viewOptions,
        currentView,
        onViewChange,
        columnToggle = true,
        customFilters,
        smartSearch,
        analyticsPanel,
        createAction,
    } = props

    const [analyticsOpen, setAnalyticsOpen] = useState(false)

    const handleAnalyticsClick = () => {
        analyticsPanel?.onClick?.()
        if (analyticsPanel?.screen) {
            setAnalyticsOpen(true)
        }
    }

    const sortableColumns = table.getAllColumns().filter(
        (column) => column.getCanSort() && column.columnDef.header
    )

    const globalFilter = table.getState().globalFilter

    const hasActiveFilters = useMemo(() => {
        const columnFilterCount = table.getState().columnFilters.reduce((acc, filter) => {
            if (Array.isArray(filter.value)) return acc + filter.value.length
            return acc + (filter.value ? 1 : 0)
        }, 0)
        return columnFilterCount > 0 || !!globalFilter
    }, [table, globalFilter])

    return (
        <>
            <div className="w-full space-y-2">
                {/* ── ROW 1: Segmentadores + Acciones ── */}
                <div className="flex items-center justify-between gap-2 h-9 w-full">
                    {/* Left: Segmentadores */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
                        {/* View toggle — shadcn Tabs inline */}
                        {viewOptions && viewOptions.length > 0 && (
                            <Tabs value={currentView} onValueChange={(v) => onViewChange?.(v)}>
                                <TabsList className="h-7 p-0 gap-0 bg-transparent border-border/60">
                                    {viewOptions.map((option) => (
                                        <TabsTrigger
                                            key={option.value}
                                            value={option.value}
                                            className="h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm"
                                        >
                                            <option.icon className="h-3.5 w-3.5" />
                                            {option.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        )}

                        {/* Faceted filters — inline popover per filter */}
                        {facetedFilters.map((filter) => {
                            const column = table.getColumn(filter.column)
                            if (!column) return null
                            const options: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[] =
                                filter.options && filter.options.length > 0
                                    ? filter.options
                                    : Array.from(column.getFacetedUniqueValues().keys())
                                        .filter(val => val !== undefined && val !== null && val !== "")
                                        .map(val => ({ label: String(val), value: String(val) }))
                                        .sort((a, b) => a.label.localeCompare(b.label))
                            return (
                                <DataTableFacetedFilter
                                    key={filter.column}
                                    column={column}
                                    title={filter.title}
                                    options={options}
                                />
                            )
                        })}

                        {/* Custom filters (inline) */}
                        {customFilters}

                        {/* Reset button */}
                        {hasActiveFilters && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        onClick={() => {
                                            table.resetColumnFilters()
                                            table.setGlobalFilter("")
                                            table.resetSorting()
                                            onReset?.()
                                        }}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Limpiar filtros</TooltipContent>
                            </Tooltip>
                        )}
                    </div>

                    {/* Right: Acciones + Create */}
                    <div className="flex items-center gap-1 shrink-0">
                        {toolbarAction && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1"
                                    >
                                        Acciones
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-[200px] p-1 border-border/80 shadow-floating"
                                >
                                    {toolbarAction}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {createAction}
                    </div>
                </div>

                {/* ── ROW 2: SmartSearch + Utilidades ── */}
                <div className="flex items-center gap-2 h-9 w-full">
                    {smartSearch && <div className="flex-1 min-w-0 h-9">{smartSearch}</div>}

                    <div className="flex items-center gap-1 shrink-0">
                        {analyticsPanel && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        onClick={handleAnalyticsClick}
                                    >
                                        <LayoutDashboard className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    Análisis de{" "}
                                    {analyticsPanel.screen?.entityName || "Panel"}
                                </TooltipContent>
                            </Tooltip>
                        )}

                        {columnToggle && (
                            <DataTableColumnToggle table={table} />
                        )}

                        {sortOptions && sortableColumns.length > 0 && (
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 shrink-0"
                                            >
                                                <ArrowUpDown className="h-3.5 w-3.5" />
                                                Orden
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Ordenar columnas</TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-[200px] p-1 border-border/80 shadow-floating"
                                >
                                    {sortableColumns.map((column) => {
                                        const isSorted = column.getIsSorted()
                                        return (
                                            <div
                                                key={column.id}
                                                className={cn(
                                                    "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-[10px] uppercase font-bold tracking-tight outline-none transition-colors",
                                                    isSorted
                                                        ? "bg-accent/50 text-primary"
                                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                )}
                                                onClick={() =>
                                                    column.toggleSorting(column.getIsSorted() === "asc")
                                                }
                                            >
                                                <div className="mr-3 flex h-3.5 w-3.5 items-center justify-center transition-all">
                                                    {isSorted === "desc" ? (
                                                        <ArrowDown className="h-3.5 w-3.5 text-primary" />
                                                    ) : isSorted === "asc" ? (
                                                        <ArrowUp className="h-3.5 w-3.5 text-primary" />
                                                    ) : (
                                                        <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                                                    )}
                                                </div>
                                                <span>
                                                    {(column.columnDef.meta as { title?: string })?.title ||
                                                        translateColumnId(column.id)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </div>

            {analyticsPanel?.screen && (
                <AnalyticsPanel
                    open={analyticsOpen}
                    onOpenChange={setAnalyticsOpen}
                    entityName={analyticsPanel.screen.entityName}
                    tabs={analyticsPanel.screen.tabs}
                    activeTab={analyticsPanel.screen.activeTab}
                    onTabChange={analyticsPanel.screen.onTabChange}
                    granularity={analyticsPanel.screen.granularity}
                    onGranularityChange={analyticsPanel.screen.onGranularityChange}
                    dateRange={analyticsPanel.screen.dateRange}
                    onDateRangeChange={analyticsPanel.screen.onDateRangeChange}
                    cardAccounts={analyticsPanel.screen.cardAccounts}
                    cardAccountId={analyticsPanel.screen.cardAccountId}
                    onCardAccountChange={analyticsPanel.screen.onCardAccountChange}
                    scope={analyticsPanel.screen.scope}
                    onScopeChange={analyticsPanel.screen.onScopeChange}
                />
            )}
        </>
    )
}
