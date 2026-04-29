"use client"

import { type ReactNode, type ElementType } from "react"
import { Plus } from "lucide-react"
import {
    Table,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────
// Column Definition
// ─────────────────────────────────────────────────────────

export interface FormLineItemColumn {
    /** Header text (or ReactNode) shown in <TableHead> */
    header: ReactNode
    /** Optional width class, e.g. "w-[150px]" or "w-[15%]" */
    width?: string
    /**
     * Text alignment for the header cell.
     * Defaults to 'center' to match the "Industrial Premium" standard.
     */
    align?: "left" | "center" | "right"
    /** Additional className forwarded to <TableHead> */
    className?: string
}

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────

export interface FormLineItemsTableProps {
    // ── Section label ────────────────────────────────────
    /** Optional icon component (Lucide) shown left of the title */
    icon?: ElementType
    /** Bold label shown above the table */
    title?: string
    /** Smaller caption next to the title (e.g. item count) */
    subtitle?: string

    // ── Columns ─────────────────────────────────────────
    /** Column definitions for <TableHeader> */
    columns: FormLineItemColumn[]

    // ── Row content (render-prop pattern) ───────────────
    /**
     * Table body content. Callers render `<TableBody>` + `<TableRow>` +
     * `<TableCell>` with their own domain-specific inputs/selectors.
     * The base component stays free of all business logic.
     */
    children: ReactNode

    // ── Actions ─────────────────────────────────────────
    /** Callback fired when the "Add line" button is clicked */
    onAdd?: () => void
    /** Button label. Defaults to "Agregar Línea" */
    addButtonText?: string
    /** When true, the add button is not rendered */
    hideAddButton?: boolean

    // ── Footer slot ──────────────────────────────────────
    /**
     * Optional content rendered to the *right* of the add button
     * in the footer row (e.g. balance summary, total costs).
     */
    footer?: ReactNode

    // ── Misc ─────────────────────────────────────────────
    className?: string
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

const alignClass: Record<NonNullable<FormLineItemColumn["align"]>, string> = {
    left:   "text-left",
    center: "text-center",
    right:  "text-right",
}

/**
 * **FormLineItemsTable** — Generic editable line-item table for forms.
 *
 * Provides the structural shell (header band, column headers, add button,
 * footer) while delegating every cell's content to the caller via `children`.
 * This lets each feature inject its own domain-specific selectors
 * (AccountSelector, ProductSelector, UoMSelector…) without polluting the
 * base component with any business logic.
 *
 * The table is **always rendered** — there is no empty-state branching.
 * When the body is empty, callers can choose to show a placeholder row
 * if needed, but the add button in the footer remains accessible at all times.
 *
 * Visual standard: "Industrial Premium" aesthetic inherited from
 * `AccountingLinesTable` — compact headers (`text-[10px] uppercase
 * tracking-widest`), centered by default, hover `primary/5`, ghost add
 * button, `IconButton` delete affordance per row.
 *
 * @example
 * ```tsx
 * <FormLineItemsTable
 *   title="Líneas de Asiento"
 *   onAdd={() => append({ ... })}
 *   columns={[
 *     { header: "Cuenta", width: "w-[300px]" },
 *     { header: "Glosa" },
 *     { header: "Debe",  width: "w-[150px]", align: "right" },
 *     { header: "Haber", width: "w-[150px]", align: "right" },
 *     { header: "",      width: "w-[50px]" },
 *   ]}
 * >
 *   <TableBody>
 *     {fields.map((field, index) => (
 *       <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
 *         <TableCell className="p-2">...</TableCell>
 *       </TableRow>
 *     ))}
 *   </TableBody>
 * </FormLineItemsTable>
 * ```
 */
export function FormLineItemsTable({
    icon: Icon,
    title,
    subtitle,
    columns,
    children,
    onAdd,
    addButtonText = "Agregar Línea",
    hideAddButton = false,
    footer,
    className,
}: FormLineItemsTableProps) {
    const showFooter = !hideAddButton || footer

    return (
        <div className={cn("space-y-2", className)}>
            {/* ── Section label band ── */}
            {(title || subtitle || Icon) && (
                <div className="flex items-center gap-2 mb-1">
                    {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
                    <div>
                        {title && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
                                {title}
                            </span>
                        )}
                        {subtitle && (
                            <span className="ml-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tight">
                                {subtitle}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* ── Table shell — always rendered ── */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            {columns.map((col, i) => (
                                <TableHead
                                    key={i}
                                    className={cn(
                                        "text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3",
                                        col.width,
                                        /* default: center — override per column with align prop */
                                        col.align ? alignClass[col.align] : "text-center",
                                        col.className,
                                    )}
                                >
                                    {col.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>

                    {/* Rows injected by the caller */}
                    {children}
                </Table>

                {/* ── Footer: add button + optional right slot ── */}
                {showFooter && (
                    <div className="flex justify-between items-center px-2 py-1.5 border-t">
                        {!hideAddButton ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 h-7 px-2"
                                onClick={onAdd}
                            >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                {addButtonText}
                            </Button>
                        ) : (
                            <div />
                        )}
                        {footer && <div>{footer}</div>}
                    </div>
                )}
            </div>
        </div>
    )
}
