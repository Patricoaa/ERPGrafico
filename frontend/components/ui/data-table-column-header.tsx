"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Column } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DataTableColumnHeaderProps<TData, TValue>
    extends React.HTMLAttributes<HTMLDivElement> {
    column: Column<TData, TValue>
    title: string
}

export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    if (!column.getCanSort()) {
        return <div className={cn(className)}>{title}</div>
    }

    return (
        <div className={cn("flex items-center justify-center space-x-2", className)}>
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent/50 hover:bg-primary/5 hover:text-primary transition-all rounded-sm"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                <span className="text-[10px] uppercase font-bold font-heading tracking-wider">{title}</span>
                {column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />
                ) : column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" />
                ) : (
                    <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-30" />
                )}
            </Button>
        </div>
    )
}
