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
    DropdownMenuCheckboxItem,
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
    customFilters?: React.ReactNode
    isCustomFiltered?: boolean
    customFilterCount?: number
    leftAction?: React.ReactNode
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
        updated_at: "Últ. Actualización",
        // Extended module fields
        date: "Fecha",
        number: "Folio",
        partner_name: "Proveedor/Cliente",
        customer_name: "Cliente",
        supplier_name: "Proveedor",
        dte_type: "Tipo Doc",
        dte_type_display: "Tipo Doc",
        payment_status: "Estado Pago",
        pending_amount: "Mto Pendiente",
        payment_method: "M. de Pago",
        reference: "Referencia",
        description: "Descripción",
        quantity: "Cantidad",
        warehouse: "Bodega",
        contact_name: "Contacto",
        is_active: "Activo",
        due_date: "Fec. Vencimiento",
        balance: "Saldo",
        currency: "Moneda"
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
        customFilters,
        isCustomFiltered,
        customFilterCount,
        leftAction,
    } = props

    const isFiltered = table.getState().columnFilters.length > 0 || table.getState().globalFilter?.length > 0 || isCustomFiltered
    const rowSelectionCount = table.getFilteredSelectedRowModel().rows.length

    // Get all columns that are sortable
    const sortableColumns = table.getAllColumns().filter(
        (column) => column.getCanSort() && column.columnDef.header
    )

    const sorting = table.getState().sorting
    const currentSort = sorting.length > 0 ? sorting[0] : null
    const currentSortColumn = currentSort ? table.getColumn(currentSort.id) : null

    return (
        <div className="w-full px-1 mb-0">
            {/* ─── UNIFIED TOOLBAR: LEFT (SEARCH) | CENTER (ACTIONS) | RIGHT (TOOLS) ─── */}
            <div className="flex items-center justify-between gap-4 h-9 w-full relative">

                {/* Left Section: Search & Batch Actions (flex-1) */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    {leftAction}
                    {batchActions}
                    {(filterColumn || globalFilterFields) && !useAdvancedFilter && (
                        <div className="relative w-64 lg:w-72 group shrink-0">
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
                                className="h-9 w-full rounded-md bg-muted/20 border-border/40 focus:bg-background transition-all text-[11px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 pr-8"
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

                {/* Center Section: Primary Actions (flex-1 + justify-center) */}
                <div className="flex-1 flex items-center justify-center min-w-0 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-2">
                        {/* Always show toolbarAction in the center of the toolbar */}
                        {toolbarAction}
                    </div>
                </div>

                {/* Right Section: Filters & Tools (flex-1 + justify-end) */}
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    {useAdvancedFilter ? (
                        <div className="flex items-center gap-2">
                            <DataTableFilters
                                table={table}
                                facetedFilters={facetedFilters}
                                filterColumn={filterColumn}
                                globalFilterFields={globalFilterFields}
                                searchPlaceholder={searchPlaceholder}
                                // We no longer pass toolbarAction into filters since it's centered in the main toolbar
                                onReset={onReset}
                                customFilters={customFilters}
                                customFilterCount={customFilterCount}
                            />
                            {showToolbarSort && sortableColumns.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full bg-transparent border-dashed border-border/60 hover:bg-muted/50 transition-all">
                                            {currentSortColumn ? (
                                                currentSort?.desc ? <ArrowDown className="h-4 w-4 text-primary" /> : <ArrowUp className="h-4 w-4 text-primary" />
                                            ) : (
                                                <ArrowUpDown className="h-4 w-4 opacity-50" />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px] rounded-md border-border/80 shadow-xl">
                                        {sortableColumns.map((column) => (
                                            <DropdownMenuItem
                                                key={column.id}
                                                onSelect={() => column.toggleSorting(column.getIsSorted() === "asc")}
                                                className="flex items-center justify-between rounded-sm px-2 py-1.5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
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
                                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full bg-transparent border-dashed border-border/60 hover:bg-muted/50 transition-all">
                                            {currentSortColumn ? (
                                                currentSort?.desc ? <ArrowDown className="h-4 w-4 text-primary" /> : <ArrowUp className="h-4 w-4 text-primary" />
                                            ) : (
                                                <ArrowUpDown className="h-4 w-4 opacity-50" />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px] rounded-md border-border/80 shadow-xl p-1">
                                        {sortableColumns.map((column) => (
                                            <DropdownMenuItem
                                                key={column.id}
                                                onSelect={() => column.toggleSorting(column.getIsSorted() === "asc")}
                                                className="flex items-center justify-between rounded-sm px-2 py-1.5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
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

                    {rightAction && (
                        <div className="flex items-center gap-2">
                            {rightAction}
                        </div>
                    )}

                    {viewOptions && viewOptions.length > 0 && (
                        <div className="flex items-center gap-1 h-9">
                            {viewOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant="outline"
                                    size="icon"
                                    className={cn(
                                        "h-9 w-9 rounded-full bg-transparent transition-all border-dashed border-border/60",
                                        currentView === option.value ? "border-primary text-primary shadow-sm" : "text-muted-foreground opacity-50 hover:bg-muted/50 hover:opacity-100"
                                    )}
                                    onClick={() => onViewChange?.(option.value)}
                                >
                                    <option.icon className="h-4 w-4" />
                                </Button>
                            ))}
                        </div>
                    )}

                    {showColumnToggle && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full bg-transparent border-dashed border-border/60 hover:bg-muted/50 transition-all">
                                    <Settings2 className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px] rounded-md border-border/80 shadow-xl">
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide() && !["actions", "select", "hub_trigger", "production_status", "logistics_status", "billing_status", "treasury_status"].includes(column.id))
                                    .map((column) => (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="flex items-center justify-between rounded-sm py-1.5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <span className="text-[10px] uppercase font-bold font-heading tracking-wider">
                                                {(column.columnDef.meta as { title?: string })?.title ||
                                                    translateColumnId(column.id)}
                                            </span>
                                        </DropdownMenuCheckboxItem>
                                    ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </div>
    )
}
