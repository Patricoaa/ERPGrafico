"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { type Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DataTableExpandHeaderProps<TData> extends React.HTMLAttributes<HTMLButtonElement> {
    table: Table<TData>
}

export function DataTableExpandHeader<TData>({ table, className, ...props }: DataTableExpandHeaderProps<TData>) {
    return (
        <Button
            type="button"
            onClick={table.getToggleAllRowsExpandedHandler()}
            title={table.getIsAllRowsExpanded() ? "Contraer todo" : "Expandir todo"}
            className={cn("p-1 bg-transparent text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0", className)}
            {...props}
        >
            {table.getIsAllRowsExpanded() ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
        </Button>
    )
}
