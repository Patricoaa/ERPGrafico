"use client"

import { Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errors"
import { DataCell } from "./DataTableCells"
import { EmptyState } from "./EmptyState"
import { SkeletonShell } from "./SkeletonShell"
import { StatusBadge } from "./StatusBadge"

/**
 * Tabla de documentos relacionados (ADR-0080, contrato document-relations.md).
 * Solo presentación: el consumidor obtiene los datos (`useDocumentRelations`) y decide cómo abrir.
 */
export interface RelatedDocumentTarget {
    label: string
    id: number
    display_id: string
    title: string
    status: string | null
    date: string | null
    partner_name: string | null
    accessible: boolean
}

export interface RelatedDocumentItem {
    semantic: string
    direction: "outgoing" | "incoming"
    role: string
    target: RelatedDocumentTarget
    amount?: string | number | null
    quantity?: string | number | null
}

export interface RelatedDocumentsTableProps {
    items?: RelatedDocumentItem[]
    isLoading?: boolean
    error?: unknown
    /** Referencias que no se pudieron resolver (documento borrado / vínculo roto). */
    unresolvedCount?: number
    onOpen: (item: RelatedDocumentItem) => void
    className?: string
}

const SEMANTIC_GROUPS: Array<{ semantic: string[]; title: string }> = [
    { semantic: ["derivation"], title: "Origen y documentos generados" },
    { semantic: ["fulfillment"], title: "Logística" },
    { semantic: ["settlement"], title: "Pagos" },
    { semantic: ["correction"], title: "Notas, devoluciones y reversiones" },
    { semantic: ["posting"], title: "Contabilidad" },
    { semantic: ["reference", "association"], title: "Otros" },
]

export const RELATED_ROLE_LABELS: Record<string, string> = {
    sale_order: "Orden de venta",
    purchase_order: "Orden de compra",
    delivery: "Despacho",
    receipt: "Recepción",
    invoice: "Factura",
    credit_note: "Nota de crédito",
    debit_note: "Nota de débito",
    corrected_invoice: "Factura corregida",
    note: "Nota",
    payment: "Pago",
    work_order: "Orden de trabajo",
    stock_move: "Movimiento de stock",
    inventory_document: "Documento de inventario",
    journal_entry: "Asiento contable",
    source_document: "Documento origen",
    return: "Devolución",
    reverses: "Revierte a",
    reversal: "Reversión",
}

export function RelatedDocumentsTable({
    items, isLoading, error, unresolvedCount = 0, onOpen, className,
}: RelatedDocumentsTableProps) {
    if (isLoading) {
        return <SkeletonShell isLoading ariaLabel="Cargando documentos relacionados" />
    }
    if (error) {
        return (
            <p className={cn("text-sm text-destructive", className)}>
                No se pudieron cargar los documentos relacionados: {getErrorMessage(error)}
            </p>
        )
    }
    if (!items || items.length === 0) {
        return (
            <EmptyState
                variant="minimal"
                icon={Link2Off}
                title="Sin documentos relacionados"
                className={className}
            />
        )
    }

    return (
        <div className={cn("space-y-4", className)}>
            {SEMANTIC_GROUPS.map((group) => {
                const rows = items.filter((item) => group.semantic.includes(item.semantic))
                if (rows.length === 0) return null
                return (
                    <section key={group.title} className="space-y-1">
                        <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</h5>
                        <ul className="divide-y divide-border rounded-md border">
                            {rows.map((item) => (
                                <li
                                    key={`${item.role}-${item.target.label}-${item.target.id}`}
                                    className={cn(
                                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-sm",
                                        item.target.status === "CANCELLED" && "opacity-60",
                                    )}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {RELATED_ROLE_LABELS[item.role] ?? item.target.title}
                                            </span>
                                            {item.target.accessible ? (
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium"
                                                    onClick={() => onOpen(item)}
                                                >
                                                    {item.target.display_id}
                                                </Button>
                                            ) : (
                                                <span className="font-medium text-muted-foreground" title="Sin permiso para ver este documento">
                                                    {item.target.display_id} · sin acceso
                                                </span>
                                            )}
                                        </div>
                                        {(item.target.partner_name || item.target.date) && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {item.target.date && <DataCell.Date value={item.target.date} size="xs" />}
                                                {item.target.partner_name && <span className="truncate">{item.target.partner_name}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 justify-self-end">
                                        {item.amount != null && <DataCell.Currency value={item.amount} size="xs" />}
                                        {item.amount == null && item.quantity != null && (
                                            <DataCell.Number value={item.quantity} decimals={2} size="xs" />
                                        )}
                                        {item.target.status && <StatusBadge status={item.target.status} variant="badge" />}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )
            })}
            {unresolvedCount > 0 && (
                <p className="text-xs text-warning">
                    {unresolvedCount} referencia(s) a documentos que ya no existen.
                </p>
            )}
        </div>
    )
}
