"use client"

import React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings2, Check } from "lucide-react"

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
    leftAction?: React.ReactNode
    /** Primary create action rendered to the right of the button group */
    createAction?: React.ReactNode
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
        customFilters,
        isCustomFiltered,
        customFilterCount,
        leftAction,
        createAction,
    } = props

    // Get all columns that are sortable
    const sortableColumns = table.getAllColumns().filter(
        (column) => column.getCanSort() && column.columnDef.header
    )

    const sorting = table.getState().sorting
    const currentSort = sorting.length > 0 ? sorting[0] : null
    const currentSortColumn = currentSort ? table.getColumn(currentSort.id) : null

    return (
        <div className="w-full mb-0">
            <div className="flex items-center gap-3 h-9 w-full">

                {/* Search — fills all available space */}
                {leftAction && (
                    <div className="flex-1 min-w-0 h-9">
                        {leftAction}
                    </div>
                )}

                {/* Button Group & Actions — fixed on the right */}
                <div className="flex items-center gap-3 shrink-0">
                    {rightAction && (
                        <div className="flex items-center gap-2">
                            {rightAction}
                        </div>
                    )}

                    <div className="flex h-10 items-center rounded-md border border-border/50 bg-background shadow-sm overflow-hidden">

                        {showToolbarSort && sortableColumns.length > 0 && (
                            <div className="border-r border-border/50 last:border-r-0 flex items-center h-full">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-full px-3 rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0">
                                            {currentSortColumn ? (
                                                currentSort?.desc ? <ArrowDown className="h-3.5 w-3.5 mr-2 text-primary" /> : <ArrowUp className="h-3.5 w-3.5 mr-2 text-primary" />
                                            ) : (
                                                <ArrowUpDown className="h-3.5 w-3.5 mr-2 opacity-50" />
                                            )}
                                            Ordenar
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
                            </div>
                        )}

                        {showColumnToggle && (
                            <div className="border-r border-border/50 last:border-r-0 flex items-center h-full">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-full px-3 rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0">
                                            <Settings2 className="h-3.5 w-3.5 mr-2 opacity-50" />
                                            Columnas
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[180px] rounded-md border-border/80 shadow-xl p-1">
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
                            </div>
                        )}

                        {viewOptions && viewOptions.length > 0 && (
                            <div className="border-r border-border/50 last:border-r-0 flex items-center h-full">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="h-full px-3 rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0"
                                        >
                                            {(() => {
                                                const activeOption = viewOptions.find(opt => opt.value === currentView) || viewOptions[0];
                                                const Icon = activeOption.icon;
                                                return (
                                                    <>
                                                        <Icon className="h-3.5 w-3.5 mr-2 opacity-50" />
                                                        {activeOption.label}
                                                    </>
                                                );
                                            })()}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[180px] rounded-md border-border/80 shadow-xl p-1">
                                        {viewOptions.map((option) => (
                                            <DropdownMenuItem
                                                key={option.value}
                                                onSelect={() => onViewChange?.(option.value)}
                                                className={cn(
                                                    "flex items-center justify-between rounded-sm px-2 py-1.5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer",
                                                    currentView === option.value && "bg-primary/5 text-primary"
                                                )}
                                            >
                                                <div className="flex items-center">
                                                    <option.icon className="h-4 w-4 mr-2" />
                                                    <span className="text-[10px] uppercase font-bold font-heading tracking-wider">
                                                        {option.label}
                                                    </span>
                                                </div>
                                                {currentView === option.value && (
                                                    <Check className="h-3.5 w-3.5" />
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {toolbarAction && (
                            <div className="border-r border-border/50 last:border-r-0 flex items-center h-full">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-full px-3 rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0">
                                            <MoreHorizontal className="h-4 w-4 mr-2 opacity-50" />
                                            Acciones
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px] rounded-md border-border/80 shadow-xl p-1 flex flex-col gap-1">
                                        {toolbarAction}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>

                    {createAction && (
                        <div className="flex items-center shrink-0 h-10">
                            {createAction}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
