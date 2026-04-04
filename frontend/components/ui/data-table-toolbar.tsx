"use client"

import React from "react"
import { X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { DataTableFilters } from "./data-table-filters"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"

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
    batchActions?: React.ReactNode
}

function translateColumnId(id: string): string {
    const translations: Record<string, string> = {
        name: "Nombre",
        code: "SKU",
        internal_code: "Cód. Interno",
        category_name: "Categoría",
        status: "Estado",
        active: "Activo",
        product_type: "Tipo",
        sale_price: "Precio",
        tax: "Impuesto",
        total: "Total",
        actions: "Acciones",
        attributes: "Atributos",
        select: "Selección",
        created_at: "Fec. Creación",
        updated_at: "Últ. Actualización"
    }
    return translations[id] || id
}

export function DataTableToolbar<TData>(props: DataTableToolbarProps<TData>) {
    const {
        table,
        filterColumn,
        globalFilterFields,
        searchPlaceholder = "Filtrar...",
        facetedFilters = [],
        toolbarAction,
        useAdvancedFilter = false,
        onReset,
        rightAction,
        showToolbarSort = false,
        viewOptions,
        currentView,
        onViewChange,
        showColumnToggle = true,
        batchActions,
    } = props

    const isFiltered = table.getState().columnFilters.length > 0 || table.getState().globalFilter?.length > 0

    // Get all columns that are sortable
    const sortableColumns = table.getAllColumns().filter(
        (column) => column.getCanSort() && column.columnDef.header
    )

    const sorting = table.getState().sorting
    const currentSort = sorting.length > 0 ? sorting[0] : null
    const currentSortColumn = currentSort ? table.getColumn(currentSort.id) : null

    return (
        <div className="flex flex-col gap-3 w-full px-1 mb-2">
            {/* ─── LEVEL 1: PRIMARY ACTIONS (HIGH HIERARCHY) ────────────────────── */}
            {(toolbarAction || rightAction) && (
                <div className="flex items-center justify-end gap-3 min-h-[40px] animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex items-center gap-2">
                        {toolbarAction}
                    </div>
                    <div className="flex items-center gap-2">
                        {rightAction}
                    </div>
                </div>
            )}

            {/* ─── LEVEL 2: OPERATIONAL CONTROLS (SEARCH, FILTERS, TOOLS) ────────── */}
            <div className="flex items-center justify-between gap-4 h-10">
                {/* Left Section: Search & Batch Actions */}
                <div className="flex items-center gap-3 flex-1">
                    {batchActions}
                    {(filterColumn || globalFilterFields) && !useAdvancedFilter && (
                        <div className="relative w-64 lg:w-80 group">
                            <Input
                                placeholder={searchPlaceholder}
                                value={filterColumn
                                    ? (table.getColumn(filterColumn)?.getFilterValue() as string ?? "")
                                    : (table.getState().globalFilter as string ?? "")
                                }
                                onChange={(event) =>
                                    filterColumn
                                        ? table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                                        : table.setGlobalFilter(event.target.value)
                                }
                                className="h-9 w-full rounded-[0.25rem] bg-muted/20 border-border/40 focus:bg-background transition-all text-[11px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 pr-8"
                            />
                            {isFiltered && (
                                <button 
                                    onClick={() => {
                                        table.resetColumnFilters()
                                        table.setGlobalFilter("")
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Section: Filters & Tools */}
                <div className="flex items-center gap-2">
                    {useAdvancedFilter ? (
                        <div className="flex items-center gap-2">
                            <DataTableFilters
                                table={table}
                                facetedFilters={facetedFilters}
                                filterColumn={filterColumn}
                                globalFilterFields={globalFilterFields}
                                searchPlaceholder={searchPlaceholder}
                                toolbarAction={null} // Action handled in level 1
                                onReset={onReset}
                            />
                            {showToolbarSort && sortableColumns.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 rounded-[0.25rem] border-dashed border-border/60 hover:bg-muted/50 transition-all">
                                            <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
                                            <span className="font-heading uppercase tracking-wider text-[10px] font-bold">Ordenar</span>
                                            {currentSortColumn && (
                                                <>
                                                    <div className="mx-2 h-4 w-px bg-border inline-block" />
                                                    <span className="text-primary font-bold font-heading uppercase tracking-wider text-[10px]">
                                                        {(currentSortColumn.columnDef.meta as { title?: string })?.title || 
                                                         translateColumnId(currentSortColumn.id)}
                                                    </span>
                                                    {currentSort?.desc ? (
                                                        <ArrowDown className="ml-2 h-3 w-3" />
                                                    ) : (
                                                        <ArrowUp className="ml-2 h-3 w-3" />
                                                    )}
                                                </>
                                            )}
                                            <ChevronDown className="ml-2 h-3 w-3 opacity-30" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px] rounded-[0.25rem] border-border/80 shadow-xl">
                                        {sortableColumns.map((column) => (
                                            <DropdownMenuItem
                                                key={column.id}
                                                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                                                className="flex items-center justify-between rounded-[0.125rem] px-2 py-1.5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                                            >
                                                <span className="text-[10px] uppercase font-bold font-heading tracking-wider">
                                                    {(column.columnDef.meta as { title?: string })?.title ||
                                                        (typeof column.columnDef.header === 'string'
                                                            ? column.columnDef.header
                                                            : column.id)}
                                                </span>
                                                {column.getIsSorted() === "desc" ? (
                                                    <ArrowDown className="h-4 w-4 text-primary" />
                                                ) : column.getIsSorted() === "asc" ? (
                                                    <ArrowUp className="h-4 w-4 text-primary" />
                                                ) : null}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {facetedFilters.map((filter) => {
                                const column = table.getColumn(filter.column)
                                if (!column) return null
                                let options = filter.options
                                if (!options || options.length === 0) {
                                    const uniqueValues = column.getFacetedUniqueValues()
                                    options = Array.from(uniqueValues.keys())
                                        .filter(val => val !== undefined && val !== null && val !== "")
                                        .map(val => ({
                                            label: String(val),
                                            value: String(val)
                                        }))
                                        .sort((a, b) => a.label.localeCompare(b.label))
                                }
                                return (
                                    <DataTableFacetedFilter
                                        key={filter.column}
                                        column={column}
                                        title={filter.title}
                                        options={options}
                                    />
                                )
                            })}
                            
                            {showToolbarSort && sortableColumns.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 rounded-[0.25rem] border-dashed border-border/60 hover:bg-muted/50 transition-all">
                                            <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
                                            <span className="font-heading uppercase tracking-wider text-[10px] font-bold">Ordenar</span>
                                            {currentSortColumn && (
                                                <>
                                                    <div className="mx-2 h-4 w-px bg-border inline-block" />
                                                    <span className="text-primary font-bold font-heading uppercase tracking-wider text-[10px]">
                                                        {(currentSortColumn.columnDef.meta as { title?: string })?.title || 
                                                         translateColumnId(currentSortColumn.id)}
                                                    </span>
                                                </>
                                            )}
                                            <ChevronDown className="ml-2 h-3 w-3 opacity-30" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px] rounded-[0.25rem] border-border/80 shadow-xl p-1">
                                        {sortableColumns.map((column) => (
                                            <DropdownMenuItem
                                                key={column.id}
                                                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                                                className="flex items-center justify-between rounded-[0.125rem] px-2 py-1.5 focus:bg-primary/10 focus:text-primary transition-colors"
                                            >
                                                <span className="text-[10px] uppercase tracking-wider font-bold font-heading">
                                                    {(column.columnDef.meta as { title?: string })?.title || 
                                                     translateColumnId(column.id)}
                                                </span>
                                                {column.getIsSorted() === "desc" ? (
                                                    <ArrowDown className="h-4 w-4 text-primary" />
                                                ) : column.getIsSorted() === "asc" ? (
                                                    <ArrowUp className="h-4 w-4 text-primary" />
                                                ) : null}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    )}

                    {viewOptions && viewOptions.length > 0 && (
                        <div className="flex items-center bg-muted/20 p-1 rounded-[0.25rem] border border-border/40 h-9">
                            {viewOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={currentView === option.value ? "secondary" : "ghost"}
                                    size="sm"
                                    className={cn(
                                        "h-7 px-3 text-[10px] gap-1.5 uppercase font-bold tracking-wider transition-all rounded-[0.125rem]",
                                        currentView === option.value ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-transparent"
                                    )}
                                    onClick={() => onViewChange?.(option.value)}
                                >
                                    <option.icon className="h-3.5 w-3.5" />
                                    <span className="hidden lg:inline">{option.label}</span>
                                </Button>
                            ))}
                        </div>
                    )}
                    
                    {showColumnToggle && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 rounded-[0.25rem] border-dashed border-border/60 gap-2 hover:bg-muted/50 transition-all">
                                    <Settings2 className="h-4 w-4 opacity-50" />
                                    <span className="hidden lg:inline font-heading uppercase tracking-wider text-[10px] font-bold">Columnas</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px] rounded-[0.25rem] border-border/80 shadow-xl">
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => (
                                        <DropdownMenuItem
                                            key={column.id}
                                            className="flex items-center justify-between rounded-[0.125rem] px-2 py-1.5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                                            onClick={() => column.toggleVisibility(!column.getIsVisible())}
                                        >
                                            <span className="text-[10px] uppercase font-bold font-heading tracking-wider">
                                                {(column.columnDef.meta as { title?: string })?.title || 
                                                 translateColumnId(column.id)}
                                            </span>
                                            {column.getIsVisible() && <div className="h-1 w-1 rounded-full bg-primary" />}
                                        </DropdownMenuItem>
                                    ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </div>
    )
}
