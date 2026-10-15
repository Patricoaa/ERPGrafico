"use client"

import { Link2Off, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DocumentActionItem } from "./DocumentActionsMenu"
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
    /** Área operativa (ADR-0083). */
    domain?: string
    /** Importe del documento (total, monto del pago…). */
    amount?: string | number | null
    /** Texto breve que distingue al documento ("Transferencia · ref. 123"). */
    detail?: string | null
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
    customer: "Cliente",
    supplier: "Proveedor",
    contact: "Contacto",
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
                                <RelatedDocumentRow
                                    key={`${item.role}-${item.target.label}-${item.target.id}`}
                                    item={item}
                                    onOpen={onOpen}
                                />
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

export interface RelatedDocumentRowProps {
    item: RelatedDocumentItem
    onOpen: (item: RelatedDocumentItem) => void
    /** Acciones sobre el documento relacionado (anular, cancelar…), en un menú "⋯". */
    actions?: DocumentActionItem[]
    /** Contraparte del documento de la ficha: si coincide, no se repite en la fila. */
    hidePartner?: string | null
}

/**
 * Fila de un documento relacionado (ADR-0083). Línea 1: código (abre su ficha) y tipo.
 * Línea 2: detalle del documento, fecha y contraparte si difiere. Derecha: importe
 * (el de la relación —p. ej. lo imputado— o el del documento), estado y acciones.
 */
export function RelatedDocumentRow({ item, onOpen, actions, hidePartner }: RelatedDocumentRowProps) {
    const { target } = item
    const amount = item.amount ?? target.amount
    const partner = target.partner_name && target.partner_name !== hidePartner ? target.partner_name : null
    const meta = [target.detail, partner].filter(Boolean).join(" · ")

    return (
        <li
            className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-3 py-2",
                target.status === "CANCELLED" && "opacity-60",
            )}
        >
            <div className="min-w-0 space-y-0.5">
                <div className="flex min-w-0 items-baseline gap-2">
                    {target.accessible ? (
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto shrink-0 p-0 font-mono text-xs font-medium"
                            onClick={() => onOpen(item)}
                        >
                            {target.display_id}
                        </Button>
                    ) : (
                        <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground" title="Sin permiso para ver este documento">
                            {target.display_id} · sin acceso
                        </span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                        {RELATED_ROLE_LABELS[item.role] ?? target.title}
                    </span>
                </div>
                {(meta || target.date) && (
                    <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {target.date && <DataCell.Date value={target.date} size="xs" className="shrink-0 justify-start" />}
                        {target.date && meta && <span aria-hidden>·</span>}
                        {meta && <span className="truncate">{meta}</span>}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3 justify-self-end">
                {amount != null && <DataCell.Currency value={amount} size="xs" className="tabular-nums" />}
                {amount == null && item.quantity != null && (
                    <DataCell.Number value={item.quantity} decimals={2} size="xs" />
                )}
                {target.status && <StatusBadge status={target.status} variant="badge" />}
                {actions && actions.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="size-7" aria-label={`Acciones de ${target.display_id}`}>
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {actions.map((action) => {
                                const Icon = action.icon
                                return (
                                    <DropdownMenuItem
                                        key={action.id}
                                        onClick={action.onClick}
                                        disabled={action.disabled}
                                        variant={action.destructive ? "destructive" : "default"}
                                    >
                                        {Icon && <Icon />}
                                        {action.label}
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </li>
    )
}
