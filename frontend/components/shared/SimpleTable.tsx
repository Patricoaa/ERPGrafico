"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface SimpleTableProps {
    rows?: number
    columns?: number
    className?: string
}

export function SimpleTable({ rows = 5, columns = 5, className }: SimpleTableProps) {
    const generateRows = Array.from({ length: rows })
    const generateColumns = Array.from({ length: columns })

    return (
        <Table className={cn("w-full", className)}>
            <TableHeader>
                <TableRow>
                    {generateColumns.map((_, colIndex) => (
                        <TableHead key={`header-${colIndex}`} className="h-12">
                            {/* Header placeholder */}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {generateRows.map((_, rowIndex) => (
                    <TableRow key={`row-${rowIndex}`} className="border-b border-border/40">
                        {generateColumns.map((_, colIndex) => (
                            <TableCell key={`cell-${rowIndex}-${colIndex}`} className="py-4">
                                {/* Cell placeholder */}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}