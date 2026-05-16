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
    customFilters?: React.ReactNode
    customFilterCount?: number
    onReset?: () => void
    className?: string
}

export function DataTableFilters<TData>({
    table,
    facetedFilters = [],
    filterColumn,
    globalFilterFields,
    searchPlaceholder = "Filtrar...",
    toolbarAction,
    customFilters,
    customFilterCount = 0,
    onReset,
    className,
}: DataTableFiltersProps<TData>) {
    const [open, setOpen] = React.useState(false)

    const globalFilter = table.getState().globalFilter
    const totalActiveFilters = table.getState().columnFilters.reduce((acc, filter) => {
        if (Array.isArray(filter.value)) {
            return acc + filter.value.length
        }
        return acc + (filter.value ? 1 : 0)
    }, 0) + (globalFilter ? 1 : 0) + customFilterCount

    const isFiltered = totalActiveFilters > 0

    return (
        <div className={cn("flex items-center", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0">
                        <div className="relative flex items-center justify-center">
                            <ListFilter className="h-3.5 w-3.5 mr-2 opacity-50" />
                            Filtros
                            {isFiltered && (
                                <Badge
                                    className="absolute -top-2 -right-4 h-4 w-4 p-0 flex items-center justify-center bg-primary text-[9px] font-black font-sans rounded-full border-2 border-background"
                                >
                                    {totalActiveFilters}
                                </Badge>
                            )}
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 rounded-md border-border/80 shadow-xl overflow-hidden" align="start">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border/40">
                        <h4 className="text-[10px] uppercase font-bold font-heading tracking-widest text-foreground/80">Filtrar</h4>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-sm hover:bg-primary/10 hover:text-primary transition-all"
                            onClick={() => setOpen(false)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="scroll-area h-full max-h-[500px] overflow-y-auto p-1">
                        {/* Custom Advanced Filters (e.g. Date Range) */}
                        {customFilters && (
                            <div className="px-3 pb-2">
                                {customFilters}
                            </div>
                        )}

                        {/* Search Section */}
                        {(filterColumn || globalFilterFields) && (
                            <div className="px-3 py-2 mb-2">
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2 font-heading">
                                    <Search className="h-3 w-3 opacity-50" />
                                    Búsqueda
                                </div>
                                {filterColumn && (
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                                        onChange={(event) =>
                                            table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                                        }
                                        className="h-9 w-full bg-background/50 border-border/40 focus:bg-background rounded-md text-[10px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 transition-all font-sans"
                                    />
                                )}
                                {!filterColumn && globalFilterFields && (
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={(table.getState().globalFilter as string) ?? ""}
                                        onChange={(event) =>
                                            table.setGlobalFilter(event.target.value)
                                        }
                                        className="h-9 w-full bg-background/50 border-border/40 focus:bg-background rounded-md text-[10px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 transition-all font-sans"
                                    />
                                )}
                            </div>
                        )}

                        {(filterColumn || globalFilterFields) && facetedFilters.length > 0 && (
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
                                    <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest font-heading">
                                        {filter.title}
                                    </div>
                                    <div className="space-y-1">
                                        {options.map((option) => {
                                            const isSelected = selectedValues.has(option.value)
                                            return (
                                                <div
                                                    key={option.value}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-[10px] uppercase font-bold font-heading tracking-wider outline-none transition-colors",
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
                                                        <Check className={cn("h-3 w-3")} />
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
                    </div>
                </PopoverContent>
            </Popover>

            {isFiltered && (
                <Button
                    variant="ghost"
                    className="h-9 px-3 border-l border-border/50 rounded-none text-[10px] uppercase font-bold tracking-widest text-primary hover:bg-primary/10 transition-all focus-visible:ring-0"
                    onClick={() => {
                        table.resetColumnFilters()
                        table.setGlobalFilter("")
                        onReset?.()
                    }}
                >
                    <X className="h-3.5 w-3.5 mr-2 opacity-70" />
                    Limpiar
                </Button>
            )}
        </div>
    )
}
