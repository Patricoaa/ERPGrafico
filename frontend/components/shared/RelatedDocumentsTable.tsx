"use client"

import { ChevronRight, Link2Off, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DocumentActionItem } from "./DocumentActionsMenu"
import { cn, parseDateOnly } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errors"
import { formatCurrency } from "@/lib/money"
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

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"] as const

function formatRowDate(isoDate: string): string {
    // Extract date part to handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ssZ" safely
    const d = parseDateOnly(isoDate.slice(0, 10))
    if (Number.isNaN(d.getTime())) return ""
    const day = d.getDate()
    const month = MONTHS[d.getMonth()]
    const year = d.getFullYear()
    return year === new Date().getFullYear() ? `${day} ${month}` : `${day} ${month} ${year}`
}

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
    // POS (vinculados al dominio origen cuando la venta viene de TPV)
    pos_session: "Sesión POS",
    pos_box: "Caja POS",
    pos_sale: "Venta POS",
    pos_collected_sale: "Venta cobrada en la sesión",
    // Tesorería extendida
    bank_reconciliation: "Conciliación bancaria",
    collection_batch: "Lote de recaudación",
    loan: "Préstamo",
    loan_payment: "Cuota de préstamo",
    bank_statement: "Extracto bancario",
    bank_transaction: "Movimiento bancario",
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
    /** El documento relacionado es el mismo documento que el que muestra el tab; no es clickeable. */
    isSelf?: boolean
}

/**
 * Fila de un documento relacionado (ADR-0083). Dos líneas: código + tipo en la primera;
 * info secundaria (detalle · fecha · importe) en la segunda, más liviana. Estado y chevron
 * (o kebab cuando hay acciones de fila) al extremo derecho.
 */
export function RelatedDocumentRow({ item, onOpen, actions, hidePartner, isSelf }: RelatedDocumentRowProps) {
    const { target } = item
    const amount = isSelf ? null : (item.amount ?? target.amount)
    const hasActions = !isSelf && !!actions && actions.length > 0
    const showDetail = target.domain === "contacts" || target.domain === "treasury"
    const partner = showDetail && target.partner_name && target.partner_name !== hidePartner ? target.partner_name : null
    const meta = showDetail ? [target.detail, partner].filter(Boolean).join(" · ") : ""
    const typeLabel = RELATED_ROLE_LABELS[item.role] ?? target.title
    const dateStr = target.date ? formatRowDate(target.date) : null
    const title = [target.display_id, typeLabel, meta, target.date].filter(Boolean).join(" · ")

    // Datos secundarios: fecha primero, luego contacto (partner + detail), luego importe/cantidad
    const secondaryParts: string[] = []
    if (dateStr) secondaryParts.push(dateStr)
    if (partner) secondaryParts.push(partner)
    if (target.detail) secondaryParts.push(target.detail)
    if (amount != null) secondaryParts.push(formatCurrency(Number(amount)))
    else if (item.quantity != null) secondaryParts.push(String(item.quantity))

    const rowContent = (
        <div className="flex flex-1 min-w-0 gap-3">
            {/* Código centrado ocupando 2 filas */}
            <div className="flex items-center justify-center shrink-0 w-16">
                <span className="font-mono text-xs font-medium text-center leading-tight">
                    {target.accessible ? target.display_id : `${target.display_id}\nsin acceso`}
                </span>
            </div>

            {/* Datos primarios y secundarios en subsecciones */}
            <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                {/* Primarios: tipo (meta va en secundarios para contactos) */}
                <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-xs text-foreground/80">{typeLabel}</span>
                    {!showDetail && meta && <span className="truncate text-xs text-muted-foreground/80">{meta}</span>}
                </div>
                {/* Secundarios: fecha, importe/cantidad */}
                {secondaryParts.length > 0 && (
                    <span className="truncate text-xs tabular-nums text-muted-foreground/70">
                        {secondaryParts.join(" · ")}
                    </span>
                )}
            </div>
        </div>
    )

    if (isSelf) {
        return (
            <li className={cn("flex items-center bg-muted/30", target.status === "CANCELLED" && "opacity-60")}>
                <div className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5">
                    {/* Código centrado ocupando 2 filas */}
                    <div className="flex items-center justify-center shrink-0 w-16">
                        <span className="font-mono text-xs font-medium text-center leading-tight">{target.display_id}</span>
                    </div>

                    {/* Datos primarios y secundarios */}
                    <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 items-baseline gap-2">
                            <span className="shrink-0 text-xs text-foreground/80">{typeLabel}</span>
                        </div>
                        {dateStr && (
                            <span className="truncate text-xs text-muted-foreground/70">{dateStr}</span>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {target.status && <StatusBadge status={target.status} variant="badge" />}
                    </div>
                </div>
            </li>
        )
    }

    return (
        <li className={cn("group flex items-stretch", target.status === "CANCELLED" && "opacity-60")}>
            {target.accessible ? (
                <button
                    type="button"
                    onClick={() => onOpen(item)}
                    title={title}
                    className="flex flex-1 min-w-0 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    {rowContent}
                    <div className="flex shrink-0 items-center gap-2">
                        {target.status && <StatusBadge status={target.status} variant="badge" />}
                        {!hasActions && <ChevronRight className="h-4 w-4 text-muted-foreground/30" />}
                    </div>
                </button>
            ) : (
                <div className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5" title="Sin permiso para ver este documento">
                    {rowContent}
                    {target.status && <StatusBadge status={target.status} variant="badge" className="shrink-0" />}
                </div>
            )}
            {hasActions && (
                <div className="flex items-center pr-2 transition-colors group-hover:bg-muted/60">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" aria-label={`Acciones de ${target.display_id}`}>
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-sm border-sidebar-border">
                            {actions.map((action) => {
                                const ActionIcon = action.icon
                                return (
                                    <DropdownMenuItem
                                        key={action.id}
                                        onClick={action.onClick}
                                        disabled={action.disabled}
                                        variant={action.destructive ? "destructive" : "default"}
                                        className="text-xs cursor-pointer"
                                    >
                                        {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                                        {action.label}
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </li>
    )
}
