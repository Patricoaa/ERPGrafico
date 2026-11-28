"use client"

import { ChevronDown, ChevronLeftIcon, ChevronRightIcon, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { PaginationState } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { SEG_TRIGGER, SEG_INACTIVE, SEG_DROPDOWN_ITEM } from './search-styles'

/** The slice of a TanStack table (with `rowPaginationFeature`) the paginator reads and drives. */
export interface PaginatedTable {
    readonly state: { readonly pagination: PaginationState }
    getRowCount: () => number
    getPageCount: () => number
    getCanPreviousPage: () => boolean
    getCanNextPage: () => boolean
    previousPage: () => void
    nextPage: () => void
    setPageIndex: (pageIndex: number) => void
    setPageSize: (pageSize: number) => void
}

interface DataTablePaginationProps {
    table: PaginatedTable
    pageSizeOptions?: number[]
}

export function DataTablePagination({
    table,
    pageSizeOptions = [10, 20, 50, 100, 500],
}: DataTablePaginationProps) {
    return (
        <div className="flex items-center justify-between px-1.5">
            <div className="flex-1 text-xs font-medium text-muted-foreground">
                Mostrando {table.state.pagination.pageIndex * table.state.pagination.pageSize + 1} a{" "}
                {Math.min(
                    (table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize,
                    table.getRowCount()
                )}{" "}
                de {table.getRowCount()} registros
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <p className="text-xs font-medium text-muted-foreground hidden sm:inline">Registros por página</p>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(SEG_TRIGGER, SEG_INACTIVE, "cursor-pointer border-none bg-transparent hover:bg-transparent")}
                            >
                                <span>{table.state.pagination.pageSize}</span>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[70px] min-w-0 p-1">
                            <DropdownMenuRadioGroup
                                value={`${table.state.pagination.pageSize}`}
                                onValueChange={(value) => table.setPageSize(Number(value))}
                            >
                                {pageSizeOptions.map((pageSize) => (
                                    <DropdownMenuRadioItem key={pageSize} value={`${pageSize}`} className={SEG_DROPDOWN_ITEM}>
                                        {pageSize}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex w-[100px] items-center justify-center text-xs font-medium text-muted-foreground">
                    Página {table.state.pagination.pageIndex + 1} de{" "}
                    {table.getPageCount()}
                </div>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-control-xs w-7 hidden lg:flex cursor-pointer border-none bg-transparent hover:bg-transparent hover:text-foreground"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Ir a la primera página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-control-xs w-7 cursor-pointer border-none bg-transparent hover:bg-transparent hover:text-foreground"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Ir a la página anterior</span>
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-control-xs w-7 cursor-pointer border-none bg-transparent hover:bg-transparent hover:text-foreground"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">Ir a la página siguiente</span>
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-control-xs w-7 hidden lg:flex cursor-pointer border-none bg-transparent hover:bg-transparent hover:text-foreground"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">Ir a la última página</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
