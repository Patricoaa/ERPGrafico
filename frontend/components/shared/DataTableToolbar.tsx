"use client"

import React, { useState, useMemo } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, X, LayoutDashboard } from "lucide-react"
import { type Table } from "@tanstack/react-table"

import { SEG_DROPDOWN_ITEM, TOOLBAR_MENU_ITEM, TOOLBAR_ICON_BTN } from './search-styles'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { LucideIcon } from "lucide-react"
import { TabBar } from "@/components/shared"
import { AnalyticsPanel, type AnalyticsTab, type Granularity } from "./AnalyticsPanel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableColumnToggle, translateColumnId } from "./DataTableColumnToggle"
import { SegmentationTableContext } from "./SegmentationTableContext"

export interface ToolbarActionItem {
    key: string
    label: string
    icon?: LucideIcon
    onClick: () => void
    intent?: 'default' | 'success' | 'destructive' | 'primary'
}

interface DataTableToolbarProps<TData> {
    table: Table<TData>
    /** Items de acciones secundarias agrupadas en dropdown "Acciones". */
    toolbarActions?: ToolbarActionItem[]
    onReset?: () => void
    sortOptions?: boolean
    viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
    currentView?: string
    onViewChange?: (view: string) => void
    columnToggle?: boolean
    unifiedSearch?: React.ReactNode
    showReset?: boolean
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
        toolbarActions,
        onReset,
        sortOptions,
        viewOptions,
        currentView,
        onViewChange,
        columnToggle,
        unifiedSearch,
        showReset,
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

    const effectiveColumnToggle = columnToggle ?? (currentView === 'list' || !currentView)
    const effectiveSortOptions = sortOptions ?? (currentView === 'card' || currentView === 'grid')

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

    const suffixContent = unifiedSearch ? (
        <>
            {effectiveColumnToggle && (
                <DataTableColumnToggle table={table} />
            )}

            {effectiveSortOptions && sortableColumns.length > 0 && (
                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={TOOLBAR_ICON_BTN}
                                >
                                    <ArrowUpDown className="h-4 w-4" />
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
                                        TOOLBAR_MENU_ITEM,
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
        </>
    ) : undefined

    const viewTabsConfig = viewOptions && viewOptions.length > 1 ? {
        items: viewOptions.map(o => ({ value: o.value, label: o.label, icon: o.icon })),
        value: currentView ?? '',
        onValueChange: (v: string) => onViewChange?.(v),
    } : undefined

    return (
        <SegmentationTableContext.Provider value={table as Table<unknown>}>
            <div className="w-full space-y-4">
                {unifiedSearch ? (
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 min-w-0">
                            {React.isValidElement(unifiedSearch)
                                ? React.cloneElement(unifiedSearch as React.ReactElement<Record<string, unknown>>, {
                                    suffix: suffixContent,
                                    viewTabs: viewTabsConfig,
                                })
                                : unifiedSearch}
                        </div>

                        {(showReset || hasActiveFilters) && (
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

                        <div className="flex items-center gap-1 shrink-0">
                            {analyticsPanel && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={TOOLBAR_ICON_BTN}
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

                            {toolbarActions && toolbarActions.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 px-2 text-xs font-semibold tracking-tight gap-1 rounded-sm shrink-0"
                                        >
                                            Acciones
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-[200px] p-1 border-border/80 shadow-floating"
                                    >
                                        {toolbarActions.map((action) => (
                                            <DropdownMenuItem
                                                key={action.key}
                                                onClick={action.onClick}
                                                className={cn(
                                                    SEG_DROPDOWN_ITEM + " flex items-center px-3 py-2 cursor-pointer transition-colors",
                                                    action.intent === 'success' && "text-success focus:bg-success/10 focus:text-success",
                                                    action.intent === 'destructive' && "text-destructive focus:bg-destructive/10 focus:text-destructive",
                                                    (!action.intent || action.intent === 'default' || action.intent === 'primary') && "text-primary focus:bg-primary/10 focus:text-primary",
                                                )}
                                            >
                                                {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                                {action.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {createAction}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 h-9 w-full">
                        {(showReset || hasActiveFilters) && (
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

                        <div className="flex items-center gap-1 shrink-0">
                            {analyticsPanel && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={TOOLBAR_ICON_BTN}
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

                            {effectiveColumnToggle && (
                                <DataTableColumnToggle table={table} />
                            )}

                            {effectiveSortOptions && sortableColumns.length > 0 && (
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={TOOLBAR_ICON_BTN}
                                                >
                                                    <ArrowUpDown className="h-4 w-4" />
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
                                                        TOOLBAR_MENU_ITEM,
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

                            {viewOptions && viewOptions.length > 1 && (
                                <TabBar
                                    value={currentView ?? ''}
                                    onValueChange={(v) => onViewChange?.(v)}
                                    items={viewOptions.map(o => ({ value: o.value, label: o.label, icon: o.icon as LucideIcon }))}
                                    className="w-auto shrink-0"
                                >
                                    <div className="hidden" />
                                </TabBar>
                            )}

                            {toolbarActions && toolbarActions.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 px-2 text-xs font-semibold tracking-tight gap-1 rounded-sm shrink-0"
                                        >
                                            Acciones
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-[200px] p-1 border-border/80 shadow-floating"
                                    >
                                        {toolbarActions.map((action) => (
                                            <DropdownMenuItem
                                                key={action.key}
                                                onClick={action.onClick}
                                                className={cn(
                                                    SEG_DROPDOWN_ITEM + " flex items-center px-3 py-2 cursor-pointer transition-colors",
                                                    action.intent === 'success' && "text-success focus:bg-success/10 focus:text-success",
                                                    action.intent === 'destructive' && "text-destructive focus:bg-destructive/10 focus:text-destructive",
                                                    (!action.intent || action.intent === 'default' || action.intent === 'primary') && "text-primary focus:bg-primary/10 focus:text-primary",
                                                )}
                                            >
                                                {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                                {action.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {createAction}
                        </div>
                    </div>
                )}
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
        </SegmentationTableContext.Provider>
    )
}
