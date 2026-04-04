"use client"

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps<TData> {
    table: Table<TData>
    pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
    table,
    pageSizeOptions = [10, 20, 50, 100],
}: DataTablePaginationProps<TData>) {
    return (
        <div className="flex items-center justify-between px-2">
            <div className="flex-1 text-[10px] uppercase font-bold font-heading tracking-widest text-muted-foreground/60">
                Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{" "}
                {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length
                )}{" "}
                de {table.getFilteredRowModel().rows.length} registros
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <p className="text-[10px] uppercase font-bold font-heading tracking-widest text-muted-foreground/60 hidden sm:inline">Registros por página</p>
                    <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value))
                        }}
                    >
                        <SelectTrigger className="h-9 w-[70px] rounded-[0.25rem] bg-background/50 border-border/40 focus:bg-background transition-all text-[10px] font-bold font-sans">
                            <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {pageSizeOptions.map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-[100px] items-center justify-center text-[10px] uppercase font-bold font-heading tracking-widest">
                    Página {table.getState().pagination.pageIndex + 1} de{" "}
                    {table.getPageCount()}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="hidden h-9 w-9 p-0 lg:flex rounded-[0.25rem] border-border/60 hover:bg-muted/50 hover:text-primary transition-all"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Ir a la primera página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-9 w-9 p-0 rounded-[0.25rem] border-border/60 hover:bg-muted/50 hover:text-primary transition-all"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Ir a la página anterior</span>
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-9 w-9 p-0 rounded-[0.25rem] border-border/60 hover:bg-muted/50 hover:text-primary transition-all"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">Ir a la página siguiente</span>
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden h-9 w-9 p-0 lg:flex rounded-[0.25rem] border-border/60 hover:bg-muted/50 hover:text-primary transition-all"
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
