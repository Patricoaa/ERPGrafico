"use client"

import * as React from "react"
import { Calendar, Check, ListFilter, Search, X } from "lucide-react"
import { Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

interface DataTableFiltersProps<TData> {
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
    filterColumn?: string
    globalFilterFields?: string[]
    searchPlaceholder?: string
    toolbarAction?: React.ReactNode
    onReset?: () => void
}

export function DataTableFilters<TData>({
    table,
    facetedFilters = [],
    filterColumn,
    globalFilterFields,
    searchPlaceholder = "Filtrar...",
    toolbarAction,
    onReset,
}: DataTableFiltersProps<TData>) {
    const [open, setOpen] = React.useState(false)

    const globalFilter = table.getState().globalFilter
    const totalActiveFilters = table.getState().columnFilters.reduce((acc, filter) => {
        if (Array.isArray(filter.value)) {
            return acc + filter.value.length
        }
        return acc + (filter.value ? 1 : 0)
    }, 0) + (globalFilter ? 1 : 0)

    const isFiltered = totalActiveFilters > 0

    return (
        <div className="flex items-center space-x-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 flex items-center gap-2">
                        <div className="relative">
                            <ListFilter className="h-4 w-4" />
                            {isFiltered && (
                                <Badge
                                    className="absolute -top-2 -right-3 h-4 w-4 p-0 flex items-center justify-center bg-blue-600 text-[10px]"
                                >
                                    {totalActiveFilters}
                                </Badge>
                            )}
                        </div>
                        <span className="ml-1">Filtros</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                    <div className="flex items-center justify-between p-4 pb-2">
                        <h4 className="font-medium leading-none">Filtrar</h4>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="scroll-area h-full max-h-[500px] overflow-y-auto p-1">
                        {/* Search Section */}
                        {(filterColumn || globalFilterFields) && (
                            <div className="px-3 py-2 mb-2">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Search className="h-3 w-3" />
                                    Búsqueda
                                </div>
                                {filterColumn && (
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                                        onChange={(event) =>
                                            table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                                        }
                                        className="h-8 w-full bg-background"
                                    />
                                )}
                                {!filterColumn && globalFilterFields && (
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={(table.getState().globalFilter as string) ?? ""}
                                        onChange={(event) =>
                                            table.setGlobalFilter(event.target.value)
                                        }
                                        className="h-8 w-full bg-background"
                                    />
                                )}
                            </div>
                        )}

                        {/* Custom Actions (Dates) Section */}
                        {toolbarAction && (
                            <div className="px-3 py-2 mb-2">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    Fecha
                                </div>
                                {toolbarAction}
                            </div>
                        )}

                        {(filterColumn || globalFilterFields || toolbarAction) && facetedFilters.length > 0 && (
                            <Separator className="my-2" />
                        )}

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
                                        value: String(val)
                                    }))
                                    .sort((a, b) => a.label.localeCompare(b.label))
                            }

                            return (
                                <div key={filter.column} className="mb-4">
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {filter.title}
                                    </div>
                                    <div className="space-y-1">
                                        {options.map((option) => {
                                            const isSelected = selectedValues.has(option.value)
                                            return (
                                                <div
                                                    key={option.value}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                        isSelected ? "bg-accent/50" : ""
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
                                                            "mr-3 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                            isSelected
                                                                ? "bg-primary text-primary-foreground"
                                                                : "opacity-50 [&_svg]:invisible"
                                                        )}
                                                    >
                                                        <Check className={cn("h-4 w-4")} />
                                                    </div>
                                                    {option.icon && (
                                                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
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
                    </div>
                </PopoverContent>
            </Popover>

            {isFiltered && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                        table.resetColumnFilters()
                        table.setGlobalFilter("")
                        onReset?.()
                    }}
                >
                    Borrar todo
                </Button>
            )}
        </div>
    )
}
