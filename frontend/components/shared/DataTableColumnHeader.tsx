"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { type Column } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DataTableColumnHeaderProps<TData, TValue>
    extends React.HTMLAttributes<HTMLDivElement> {
    column: Column<TData, TValue>
    title: string
}

const headerTextClass = "text-xs font-medium text-muted-foreground"

export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    if (!column.getCanSort()) {
        return <div className={cn("flex items-center", headerTextClass, className)}>{title}</div>
    }

    return (
        <div className={cn("flex items-center justify-center space-x-1.5", className)}>
            <Button
                variant="ghost"
                size="sm"
                style={{ height: "var(--table-header-btn-h, 1.75rem)" }}
                className="-ml-2 data-[state=open]:bg-accent/50 hover:bg-primary/5 hover:text-primary transition-all rounded-sm"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                <span className={headerTextClass}>{title}</span>
                {column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-1 size-3 text-primary" />
                ) : column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-1 size-3 text-primary" />
                ) : (
                    <ArrowUpDown className="ml-1 size-3 opacity-30" />
                )}
            </Button>
        </div>
    )
}
