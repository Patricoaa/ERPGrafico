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
    className?: string
}

export function DataTableFilters<TData>({
    table,
    facetedFilters = [],
    filterColumn,
    globalFilterFields,
    searchPlaceholder = "Filtrar...",
    toolbarAction,
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
    }, 0) + (globalFilter ? 1 : 0)

    const isFiltered = totalActiveFilters > 0

    return (
        <div className={cn("flex items-center space-x-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 flex items-center gap-2 px-4 rounded-[0.25rem] border-dashed border-border/60 hover:bg-muted/50 transition-all font-heading uppercase tracking-wider text-[10px] font-bold">
                        <div className="relative">
                            <ListFilter className="h-4 w-4 opacity-70" />
                            {isFiltered && (
                                <Badge
                                    className="absolute -top-2.5 -right-3 h-4 w-4 p-0 flex items-center justify-center bg-primary text-[9px] font-black font-sans rounded-full border-2 border-background"
                                >
                                    {totalActiveFilters}
                                </Badge>
                            )}
                        </div>
                        <span className="ml-1">Filtros</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 rounded-[0.25rem] border-border/80 shadow-xl overflow-hidden" align="start">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border/40">
                        <h4 className="text-[10px] uppercase font-bold font-heading tracking-widest text-foreground/80">Filtrar</h4>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-[0.125rem] hover:bg-primary/10 hover:text-primary transition-all"
                            onClick={() => setOpen(false)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="scroll-area h-full max-h-[500px] overflow-y-auto p-1">
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
                                        className="h-9 w-full bg-background/50 border-border/40 focus:bg-background rounded-[0.25rem] text-[10px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 transition-all font-sans"
                                    />
                                )}
                                {!filterColumn && globalFilterFields && (
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={(table.getState().globalFilter as string) ?? ""}
                                        onChange={(event) =>
                                            table.setGlobalFilter(event.target.value)
                                        }
                                        className="h-9 w-full bg-background/50 border-border/40 focus:bg-background rounded-[0.25rem] text-[10px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 transition-all font-sans"
                                    />
                                )}
                            </div>
                        )}

                        {/* Custom Actions (Dates) Section */}
                        {toolbarAction && (
                            <div className="px-3 py-2 mb-2">
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2 font-heading">
                                    <Calendar className="h-3 w-3 opacity-50" />
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
                                                        "relative flex cursor-pointer select-none items-center rounded-[0.125rem] px-3 py-1.5 text-[10px] uppercase font-bold font-heading tracking-wider outline-none transition-colors",
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
                                                            "mr-3 flex h-3.5 w-3.5 items-center justify-center rounded-[0.125rem] border border-primary/50 transition-all",
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
                    size="sm"
                    className="h-9 px-3 text-primary hover:text-primary hover:bg-primary/10 rounded-[0.25rem] text-[10px] uppercase font-bold font-heading tracking-widest transition-all"
                    onClick={() => {
                        table.resetColumnFilters()
                        table.setGlobalFilter("")
                        onReset?.()
                    }}
                >
                    <X className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                    Borrar todo
                </Button>
            )}
        </div>
    )
}
