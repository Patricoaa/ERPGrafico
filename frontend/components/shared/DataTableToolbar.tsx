"use client"

import React, { useState, useMemo } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Settings2, Check, X, ListFilter } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { cn, translateFieldName } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Drawer } from "./Drawer"
import { UnderlineTabs, type TabItem } from "./UnderlineTabs"
import { EntityStatsBottomSheet, type Section } from "./EntityStatsBottomSheet"

interface DataTableToolbarProps<TData> {
    table: Table<TData>
    filterColumn?: string
    globalFilterFields?: string[]
    searchPlaceholder?: string
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
    useAdvancedFilter?: boolean
    onReset?: () => void
    rightAction?: React.ReactNode
    showToolbarSort?: boolean
    viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
    currentView?: string
    onViewChange?: (view: string) => void
    showColumnToggle?: boolean
    customFilters?: React.ReactNode
    isCustomFiltered?: boolean
    customFilterCount?: number

    /** Optional tabs on the left side of the toolbar */
    tabs?: {
        items: TabItem[]
        value: string
        onValueChange: (value: string) => void
    }
    /** Optional stats button (ghost icon) rendered in the button group.
     *  If `sheet` is provided, the toolbar manages an EntityStatsBottomSheet internally
     *  (open/close state and rendering). If only `onClick` is provided, it's a simple
     *  button handler for custom drawers. */
    statsAction?: StatsActionConfig

    /** SmartSearchBar (or any left-aligned content) shown in the toolbar between tabs and right buttons */
    leftAction?: React.ReactNode

    createAction?: React.ReactNode
    rightButtonGroupAction?: React.ReactNode
}

export type StatsActionConfig = {
    icon: React.ComponentType<{ className?: string }>
    onClick?: () => void
    sheet?: {
        title: string
        description?: string
        icon?: LucideIcon
        sections: Section[]
        segments?: { value: string; label: string; icon?: LucideIcon }[]
        activeSegment?: string
        onSegmentChange?: (value: string) => void
        layout?: "stack" | "auto"
    }
}

const COLUMN_BLOCKLIST = new Set([
    "actions", "select", "hub_trigger",
    "production_status", "logistics_status",
    "billing_status", "treasury_status",
])

function translateColumnId(id: string): string {
    const translations: Record<string, string> = {
        code: "SKU",
        internal_code: "Cód. Interno",
        created_at: "Fec. Creación",
        updated_at: "Últ. Actualización",
        partner_name: "Proveedor/Cliente",
        customer_name: "Cliente",
        supplier_name: "Proveedor",
        contact_name: "Contacto",
        pending_amount: "Mto Pendiente",
        payment_method: "M. de Pago",
        prevision: "Previsión / Salud",
    }
    return translations[id] || translateFieldName(id) || id
}

export function DataTableToolbar<TData>(props: DataTableToolbarProps<TData>) {
    const {
        table,
        facetedFilters = [],
        toolbarAction,
        onReset,
        rightAction,
        showToolbarSort = false,
        viewOptions,
        currentView,
        onViewChange,
        showColumnToggle = true,
        customFilters,
        customFilterCount = 0,
        tabs,
        leftAction,
        statsAction,
        createAction,
        rightButtonGroupAction,
    } = props

    const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
    const [statsSheetOpen, setStatsSheetOpen] = useState(false)

    const handleStatsClick = () => {
        statsAction?.onClick?.()
        if (statsAction?.sheet) {
            setStatsSheetOpen(true)
        }
    }

    const sortableColumns = table.getAllColumns().filter(
        (column) => column.getCanSort() && column.columnDef.header
    )

    const globalFilter = table.getState().globalFilter

    const totalActiveFilters = useMemo(() => {
        const columnFilterCount = table.getState().columnFilters.reduce((acc, filter) => {
            if (Array.isArray(filter.value)) return acc + filter.value.length
            return acc + (filter.value ? 1 : 0)
        }, 0)
        return columnFilterCount + (globalFilter ? 1 : 0) + customFilterCount
    }, [table, globalFilter, customFilterCount])

    const isFiltered = totalActiveFilters > 0

    const hasConfigContent = showToolbarSort ||
        showColumnToggle ||
        (viewOptions && viewOptions.length > 0) ||
        facetedFilters.length > 0 ||
        customFilters

    return (
        <>
            <div className="w-full">
                <div className="flex items-center gap-3 h-9 w-full">

                    {/* Tabs — on the left */}
                    {tabs && (
                        <div className="flex-1 min-w-0">
                            <UnderlineTabs
                                items={tabs.items}
                                value={tabs.value}
                                onValueChange={tabs.onValueChange}
                                orientation="horizontal"
                                variant="underline"
                                className="w-auto"
                                headerClassName="h-9 px-0 bg-transparent"
                                contentClassName="hidden"
                            >
                                <div />
                            </UnderlineTabs>
                        </div>
                    )}

                    {/* SmartSearchBar — fills remaining space */}
                    {leftAction && (
                        <div className="flex-1 min-w-0 h-9">
                            {leftAction}
                        </div>
                    )}

                    {/* Right side: config + button group + create */}
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                        {rightAction && (
                            <div className="flex items-center gap-2">
                                {rightAction}
                            </div>
                        )}

                        {/* Config button with filter indicator */}
                        {hasConfigContent && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 relative shrink-0"
                                onClick={() => setConfigDrawerOpen(true)}
                            >
                                <Settings2 className="h-4 w-4" />
                                {isFiltered && (
                                    <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary ring-1 ring-background" />
                                )}
                            </Button>
                        )}

                        {/* Main button group */}
                        <div className="flex h-9 items-center rounded-md bg-background divide-x divide-border/50 overflow-hidden">
                            {statsAction && (
                                <div className="flex items-center h-full">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-full px-2 rounded-none hover:bg-muted/50 transition-all ring-0 focus-visible:ring-0"
                                        onClick={handleStatsClick}
                                    >
                                        <statsAction.icon className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {rightButtonGroupAction && (
                                <div className="flex items-center h-full">
                                    {rightButtonGroupAction}
                                </div>
                            )}

                            {toolbarAction && (
                                <div className="flex items-center h-full">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-full px-3 rounded-none text-[10px] uppercase tracking-widest hover:bg-muted/50 transition-all ring-0 focus-visible:ring-0">
                                                <MoreHorizontal className="h-4 w-4 mr-2 opacity-50" />
                                                Acciones
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[200px] border-border/80 shadow-floating p-1 flex flex-col gap-1">
                                            {toolbarAction}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>

                        {createAction && (
                            <div className="flex items-center shrink-0 h-9">
                                {createAction}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Config Drawer (right) */}
            <Drawer
                open={configDrawerOpen}
                onOpenChange={setConfigDrawerOpen}
                side="right"
                title="Ajustes"
                defaultSize="340px"
                minSize="300px"
                maxSize="450px"
            >
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                        {/* Custom filters */}
                        {customFilters && (
                            <div>
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2 font-heading">
                                    <ListFilter className="h-3 w-3 opacity-50" />
                                    Filtros
                                </div>
                                {customFilters}
                            </div>
                        )}

                        {/* Faceted filters */}
                        {facetedFilters.map((filter, index) => {
                            const column = table.getColumn(filter.column)
                            if (!column) return null

                            const selectedValues = new Set(column.getFilterValue() as string[])
                            let options = filter.options

                            if (!options || options.length === 0) {
                                const uniqueValues = column.getFacetedUniqueValues()
                                options = Array.from(uniqueValues.keys())
                                    .filter(val => val !== undefined && val !== null && val !== "")
                                    .map(val => ({
                                        label: String(val),
                                        value: String(val),
                                    }))
                                    .sort((a, b) => a.label.localeCompare(b.label))
                            }

                            return (
                                <div key={filter.column}>
                                    <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 font-heading">
                                        {filter.title}
                                    </div>
                                    <div className="space-y-1">
                                        {options.map((option) => {
                                            const isSelected = selectedValues.has(option.value)
                                            return (
                                                <div
                                                    key={option.value}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-xs uppercase font-bold font-heading tracking-wider outline-none transition-colors",
                                                        isSelected ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                                                    )}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            selectedValues.delete(option.value)
                                                        } else {
                                                            selectedValues.add(option.value)
                                                        }
                                                        const filterValues = Array.from(selectedValues)
                                                        column.setFilterValue(
                                                            filterValues.length ? filterValues : undefined
                                                        )
                                                    }}
                                                >
                                                    <div
                                                        className={cn(
                                                            "mr-3 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary/50 transition-all",
                                                            isSelected
                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                : "opacity-50 [&_svg]:invisible"
                                                        )}
                                                    >
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                    {option.icon && (
                                                        <option.icon className="mr-2 h-3.5 w-3.5 opacity-60" />
                                                    )}
                                                    <span>{option.label}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {index < facetedFilters.length - 1 && (
                                        <Separator className="mt-4" />
                                    )}
                                </div>
                            )
                        })}

                        {/* Sort */}
                        {showToolbarSort && sortableColumns.length > 0 && (
                            <div>
                                {(customFilters || facetedFilters.length > 0) && (
                                    <Separator className="my-4" />
                                )}
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2 font-heading">
                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                    Ordenar
                                </div>
                                <div className="space-y-1">
                                    {sortableColumns.map((column) => {
                                        const isSorted = column.getIsSorted()
                                        return (
                                            <div
                                                key={column.id}
                                                className={cn(
                                                    "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-xs uppercase font-bold font-heading tracking-wider outline-none transition-colors",
                                                    isSorted ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                                                )}
                                                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
                                </div>
                            </div>
                        )}

                        {/* View */}
                        {viewOptions && viewOptions.length > 0 && (
                            <div>
                                {(customFilters || facetedFilters.length > 0 || (showToolbarSort && sortableColumns.length > 0)) && (
                                    <Separator className="my-4" />
                                )}
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 font-heading">
                                    Vista
                                </div>
                                <div className="space-y-1">
                                    {viewOptions.map((option) => (
                                        <div
                                            key={option.value}
                                            className={cn(
                                                "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-xs uppercase font-bold font-heading tracking-wider outline-none transition-colors",
                                                currentView === option.value
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                                            )}
                                            onClick={() => onViewChange?.(option.value)}
                                        >
                                            <div className="mr-3 flex h-3.5 w-3.5 items-center justify-center">
                                                <option.icon className="h-3.5 w-3.5 opacity-60" />
                                            </div>
                                            <span>{option.label}</span>
                                            {currentView === option.value && (
                                                <Check className="h-3 w-3 ml-auto text-primary" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Columns */}
                        {showColumnToggle && (
                            <div>
                                {(customFilters || facetedFilters.length > 0 || (showToolbarSort && sortableColumns.length > 0) || (viewOptions && viewOptions.length > 0)) && (
                                    <Separator className="my-4" />
                                )}
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 font-heading">
                                    Columnas
                                </div>
                                <div className="space-y-1">
                                    {table
                                        .getAllColumns()
                                        .filter((column) => column.getCanHide() && !COLUMN_BLOCKLIST.has(column.id))
                                        .map((column) => (
                                            <div
                                                key={column.id}
                                                className={cn(
                                                    "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-xs uppercase font-bold font-heading tracking-wider outline-none transition-colors",
                                                    column.getIsVisible() ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                                                )}
                                                onClick={() => column.toggleVisibility(!column.getIsVisible())}
                                            >
                                                <div
                                                    className={cn(
                                                        "mr-3 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary/50 transition-all",
                                                        column.getIsVisible()
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "opacity-50 [&_svg]:invisible"
                                                    )}
                                                >
                                                    <Check className="h-3 w-3" />
                                                </div>
                                                <span>
                                                    {(column.columnDef.meta as { title?: string })?.title ||
                                                        translateColumnId(column.id)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reset */}
                    {isFiltered && (
                        <div className="border-t border-border/40 p-4 shrink-0">
                            <Button
                                variant="outline"
                                className="w-full h-9 text-[10px] font-bold uppercase tracking-widest"
                                onClick={() => {
                                    table.resetColumnFilters()
                                    table.setGlobalFilter("")
                                    table.resetSorting()
                                    onReset?.()
                                }}
                            >
                                <X className="h-3.5 w-3.5 mr-2" />
                                Limpiar filtros
                            </Button>
                        </div>
                    )}
                </div>
            </Drawer>

            {/* Stats sheet — managed internally when sheet config provided */}
            {statsAction?.sheet && (
                <EntityStatsBottomSheet
                    open={statsSheetOpen}
                    onOpenChange={setStatsSheetOpen}
                    title={statsAction.sheet.title}
                    description={statsAction.sheet.description}
                    icon={statsAction.sheet.icon}
                    sections={statsAction.sheet.sections}
                    segments={statsAction.sheet.segments}
                    activeSegment={statsAction.sheet.activeSegment}
                    onSegmentChange={statsAction.sheet.onSegmentChange}
                    layout={statsAction.sheet.layout}
                />
            )}
        </>
    )
}
