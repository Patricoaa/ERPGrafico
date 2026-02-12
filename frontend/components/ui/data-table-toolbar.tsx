"use client"

import { X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { DataTableFilters } from "./data-table-filters"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                {(filterColumn || globalFilterFields) && !useAdvancedFilter && (
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
                        className="h-8 w-[150px] lg:w-[250px]"
                    />
                )}
                {useAdvancedFilter ? (
                    <DataTableFilters
                        table={table}
                        facetedFilters={facetedFilters}
                        filterColumn={filterColumn}
                        globalFilterFields={globalFilterFields}
                        searchPlaceholder={searchPlaceholder}
                        toolbarAction={toolbarAction}
                        onReset={onReset}
                    />
                ) : (
                    <>
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
                        {sortableColumns.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                        Ordenar
                                        {currentSortColumn && (
                                            <>
                                                <DropdownMenuSeparator className="mx-2 h-4 w-px bg-border inline-block" />
                                                <span className="text-primary font-medium">
                                                    {(currentSortColumn.columnDef.meta as any)?.title ||
                                                        (typeof currentSortColumn.columnDef.header === 'string'
                                                            ? currentSortColumn.columnDef.header
                                                            : currentSortColumn.id)}
                                                </span>
                                                {currentSort?.desc ? (
                                                    <ArrowDown className="ml-2 h-3 w-3" />
                                                ) : (
                                                    <ArrowUp className="ml-2 h-3 w-3" />
                                                )}
                                            </>
                                        )}
                                        <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[200px]">
                                    {sortableColumns.map((column) => (
                                        <DropdownMenuItem
                                            key={column.id}
                                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                                            className="flex items-center justify-between"
                                        >
                                            <span>
                                                {(column.columnDef.meta as any)?.title ||
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
                                    {currentSort && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => table.resetSorting()} className="text-destructive focus:text-destructive">
                                                Limpiar orden
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {toolbarAction}
                        {isFiltered && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    table.resetColumnFilters()
                                    table.setGlobalFilter("")
                                }}
                                className="h-8 px-2 lg:px-3"
                            >
                                Resetear
                                <X className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </>
                )}
            </div>
            {rightAction && (
                <div className="flex items-center space-x-2">
                    {rightAction}
                </div>
            )}
        </div>
    )
}
