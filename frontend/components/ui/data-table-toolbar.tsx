"use client"

import { X } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"

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
}

export function DataTableToolbar<TData>({
    table,
    filterColumn,
    globalFilterFields,
    searchPlaceholder = "Filtrar...",
    facetedFilters = [],
}: DataTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0 || table.getState().globalFilter?.length > 0

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                {filterColumn && (
                    <Input
                        placeholder={searchPlaceholder}
                        value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                        }
                        className="h-8 w-[150px] lg:w-[250px]"
                    />
                )}
                {!filterColumn && globalFilterFields && (
                    <Input
                        placeholder={searchPlaceholder}
                        value={(table.getState().globalFilter as string) ?? ""}
                        onChange={(event) =>
                            table.setGlobalFilter(event.target.value)
                        }
                        className="h-8 w-[150px] lg:w-[250px]"
                    />
                )}
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
            </div>
        </div>
    )
}
