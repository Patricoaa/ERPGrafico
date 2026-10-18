"use client"

import { Package } from "lucide-react"
import { DataCell, DocumentFieldGrid, FormSection } from "@/components/shared"
import { DocumentLinesTable } from "./DocumentLinesTable"
import { DocumentTotalsBox } from "./DocumentTotalsBox"
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
    const subtotal = lines.reduce((sum, line) => sum + num(line.subtotal_net ?? line.subtotal), 0)
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
                <DocumentLinesTable lines={lines} kind={kind} />
                <DocumentTotalsBox
                    subtotal={subtotal}
                    tax={num(order.total_tax)}
                    total={total}
                    paid={num(order.total_paid)}
                    pending={num(order.pending_amount)}
                />
            </section>
        </div>
    )
}
