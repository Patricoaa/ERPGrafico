"use client"

import { ChevronDown, ChevronLeftIcon, ChevronRightIcon, ChevronsLeft, ChevronsRight } from "lucide-react"
import { type Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { SEG_WRAPPER, SEG_TRIGGER, SEG_INACTIVE, SEG_DROPDOWN_ITEM } from './search-styles'

interface DataTablePaginationProps<TData> {
    table: Table<TData>
    pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
    table,
    pageSizeOptions = [10, 20, 50, 100, 500],
}: DataTablePaginationProps<TData>) {
    return (
        <div className="flex items-center justify-between px-2">
            <div className="flex-1 text-[10px] uppercase font-black  tracking-widest text-muted-foreground/60">
                Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{" "}
                {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getRowCount()
                )}{" "}
                de {table.getRowCount()} registros
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 hidden sm:inline">Registros por página</p>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(SEG_TRIGGER, SEG_INACTIVE)}
                            >
                                <span>{table.getState().pagination.pageSize}</span>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[70px] min-w-0 p-1">
                            <DropdownMenuRadioGroup
                                value={`${table.getState().pagination.pageSize}`}
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
                <div className="flex w-[100px] items-center justify-center text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">
                    Página {table.getState().pagination.pageIndex + 1} de{" "}
                    {table.getPageCount()}
                </div>
                <div className={SEG_WRAPPER}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hidden lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Ir a la primera página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Ir a la página anterior</span>
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">Ir a la página siguiente</span>
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hidden lg:flex"
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
