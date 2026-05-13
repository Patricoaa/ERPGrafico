/**
 * ExpandableTableRow
 *
 * Primitiva reutilizable para filas de tabla que expanden un panel de detalle.
 * Encapsula el trigger (chevron), la animación (AnimatePresence/motion.div) y
 * el shell del panel expandido, delegando el contenido al consumidor.
 *
 * Patrón canónico para vistas de listado con detalle inline (PortfolioTable,
 * BlacklistView). Documentado en:
 *   docs/20-contracts/component-datatable-views.md — §"Expandable Row"
 *
 * @example
 * ```tsx
 * function MyRow({ row, onRefresh }: { row: Row<MyType>, onRefresh: () => void }) {
 *     const [data, setData] = useState<Detail[] | null>(null)
 *     const [loading, setLoading] = useState(false)
 *
 *     const handleExpand = useCallback(async (isExpanding: boolean) => {
 *         if (isExpanding && !data) {
 *             setLoading(true)
 *             setData(await fetchDetail(row.original.id))
 *             setLoading(false)
 *         }
 *     }, [data, row.original.id])
 *
 *     return (
 *         <ExpandableTableRow row={row} onExpand={handleExpand}>
 *             {loading ? <TableSkeleton rows={2} /> : <MyDetailPanel data={data} />}
 *         </ExpandableTableRow>
 *     )
 * }
 * ```
 */

"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronRight } from "lucide-react"
import { flexRender, type Row, type Cell } from "@tanstack/react-table"
import { TableRow, TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpandableTableRowProps<TData> {
    /** TanStack Table row — provides cells and selection state */
    row: Row<TData>

    /**
     * Content rendered inside the animated detail panel when the row is expanded.
     * Receives `isExpanded` to support lazy rendering patterns.
     */
    children: React.ReactNode

    /**
     * Called when the row expands/collapses.
     * Receives the new expanded state (`true` = opening).
     * Use to trigger lazy data fetching on first open.
     */
    onExpand?: (isExpanding: boolean) => void | Promise<void>

    /**
     * Default expanded state. Useful for controlled expansion
     * (e.g., open specific row from parent). Uncontrolled by default.
     */
    defaultExpanded?: boolean

    /** Additional classes for the main TableRow */
    className?: string

    /**
     * Classes forwarded to the expanded panel wrapper div.
     * Defaults to `"px-8 py-4 bg-background"`.
     */
    panelClassName?: string

    /**
     * Horizontal padding of cells in the main row.
     * @default "py-3 px-4 text-center"
     */
    cellClassName?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpandableTableRow<TData>({
    row,
    children,
    onExpand,
    defaultExpanded = false,
    className,
    panelClassName = "px-8 py-4 bg-background",
    cellClassName = "py-3 px-4 text-center",
}: ExpandableTableRowProps<TData>) {
    const [expanded, setExpanded] = useState(defaultExpanded)

    const handleToggle = async () => {
        const next = !expanded
        setExpanded(next)
        if (onExpand) await onExpand(next)
    }

    const colSpan = row.getVisibleCells().length + 1 // +1 for chevron cell

    return (
        <>
            {/* ── Main data row ── */}
            <TableRow
                className={cn(
                    "cursor-pointer hover:bg-muted/30 transition-colors text-sm",
                    expanded && "bg-muted/20",
                    className
                )}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={handleToggle}
            >
                {row.getVisibleCells().map((cell: Cell<TData, unknown>) => (
                    <TableCell key={cell.id} className={cellClassName}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                ))}

                {/* Expand/collapse chevron */}
                <TableCell className="w-12 px-3 py-3 text-center text-muted-foreground">
                    {expanded
                        ? <ChevronDown className="mx-auto h-4 w-4" />
                        : <ChevronRight className="mx-auto h-4 w-4" />
                    }
                </TableCell>
            </TableRow>

            {/* ── Detail panel (animated) ── */}
            <AnimatePresence>
                {expanded && (
                    <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={colSpan} className="border-b p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden border-b border-border/50 bg-background"
                            >
                                <div className={panelClassName}>
                                    {children}
                                </div>
                            </motion.div>
                        </TableCell>
                    </TableRow>
                )}
            </AnimatePresence>
        </>
    )
}

export type { ExpandableTableRowProps }
