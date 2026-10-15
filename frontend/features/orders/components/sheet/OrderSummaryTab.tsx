"use client"

import { useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable, DocumentFieldGrid, FormSection } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"
import { orderLineFields } from "../../orderLineFields"
import type { Order, OrderLine } from "../../types"

interface OrderSummaryTabProps {
    order: Order
    kind: "sale" | "purchase"
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null)
const num = (value: unknown) => {
    const n = parseFloat(String(value ?? 0))
    return Number.isFinite(n) ? n : 0
}

/** Las celdas DataCell se centran por defecto; en la ficha van a la izquierda. */
const LEFT = "w-auto justify-start text-left"

/**
 * Fecha del documento con hora: `date` es solo fecha; la hora sale de `created_at`
 * cuando ambos son el mismo día (orden creada en su fecha). Si no, solo la fecha.
 */
function documentDateTime(order: Order): { value: string; showTime: boolean } | null {
    const created = typeof order.created_at === "string" ? order.created_at : null
    if (!order.date) return created ? { value: created, showTime: true } : null
    if (created && new Date(created).toLocaleDateString("sv-SE") === order.date) return { value: created, showTime: true }
    return { value: order.date, showTime: false }
}

/**
 * Tab Resumen de la ficha de OV/OC (ADR-0083, referencia para las demás fichas):
 * Contexto en una fila (contraparte, fecha y hora, canal, notas) y Productos (tabla + totales).
 */
export function OrderSummaryTab({ order, kind }: OrderSummaryTabProps) {
    const isSale = kind === "sale"
    const partnerName = isSale
        ? (typeof order.customer_name === "string" ? order.customer_name : order.customer_name?.name)
        : order.supplier_name
    const partnerId = isSale
        ? (typeof order.customer === "number" ? order.customer : order.customer?.id)
        : (typeof order.supplier === "number" ? order.supplier : order.supplier?.id)
    const when = documentDateTime(order)

    const lines: OrderLine[] = order.lines ?? order.items ?? []
    const columns = useMemo(() => orderLineFields.toColumns(), [])
    const subtotal = lines.reduce((sum, line) => sum + num(line.subtotal), 0)
    const total = num(order.effective_total ?? order.total)

    return (
        <div className="space-y-8">
            {/* Contexto: una sola fila, sin separador (lo encabeza el propio documento) */}
            <section aria-label="Contexto">
                <DocumentFieldGrid
                    fields={[
                        {
                            label: isSale ? "Cliente" : "Proveedor",
                            value: partnerName
                                ? <DataCell.ContactLink contactId={partnerId} className={LEFT}>{partnerName}</DataCell.ContactLink>
                                : null,
                        },
                        {
                            label: "Fecha",
                            value: when ? <DataCell.Date value={when.value} showTime={when.showTime} size="xs" className={LEFT} /> : null,
                        },
                        { label: "Canal", value: text(order.channel_display), hidden: !isSale },
                        { label: "Bodega", value: text(order.warehouse_name), hidden: isSale },
                        { label: "Sesión POS", value: text(order.pos_session_display), hidden: !isSale || !order.pos_session },
                        {
                            label: "Notas",
                            value: text(order.notes) && <span className="line-clamp-2" title={text(order.notes) ?? undefined}>{text(order.notes)}</span>,
                        },
                    ]}
                />
            </section>

            <section className="space-y-4">
                <FormSection title="Productos" icon={Package} />
                <DataTable columns={columns} data={lines} variant="minimal" />
                <dl className="ml-auto w-full max-w-xs space-y-1.5 rounded-md border px-4 py-3 text-xs tabular-nums">
                    <TotalRow label="Subtotal (neto)" value={subtotal} />
                    <TotalRow label="IVA" value={num(order.total_tax)} />
                    <TotalRow label="Total" value={total} strong />
                    <div className="border-t pt-1.5" />
                    <TotalRow label="Pagado" value={num(order.total_paid)} />
                    <TotalRow label="Saldo pendiente" value={num(order.pending_amount)} strong={num(order.pending_amount) > 0} />
                </dl>
            </section>
        </div>
    )
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("font-medium", strong && "font-bold text-foreground")}>{formatCurrency(value)}</dd>
        </div>
    )
}
