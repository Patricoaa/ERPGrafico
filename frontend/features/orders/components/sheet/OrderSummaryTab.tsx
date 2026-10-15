"use client"

import { Banknote, CalendarClock, ClipboardList, Scale } from "lucide-react"
import { DataCell, DocumentFieldGrid, FormSection, StatusBadge } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import type { Order } from "../../types"

interface OrderSummaryTabProps {
    order: Order
    kind: "sale" | "purchase"
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null)
const money = (value: unknown) => (value === null || value === undefined || value === "" ? null : formatCurrency(Number(value)))
const date = (value: unknown) => (typeof value === "string" && value ? <DataCell.Date value={value} size="xs" /> : null)
const status = (value: unknown) => (typeof value === "string" && value ? <StatusBadge status={value} variant="badge" /> : null)

/**
 * Tab Resumen de la ficha de OV/OC (ADR-0083): capas de form-layout-architecture §3 —
 * Contexto (qué) · Condiciones (cómo) · Totales (resultado) · Ciclo de vida (cuándo/estado).
 */
export function OrderSummaryTab({ order, kind }: OrderSummaryTabProps) {
    const isSale = kind === "sale"
    const partnerName = isSale
        ? (typeof order.customer_name === "string" ? order.customer_name : order.customer_name?.name)
        : order.supplier_name
    const partnerId = isSale
        ? (typeof order.customer === "number" ? order.customer : order.customer?.id)
        : (typeof order.supplier === "number" ? order.supplier : order.supplier?.id)

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <FormSection title="Contexto" icon={ClipboardList} />
                <DocumentFieldGrid
                    fields={[
                        {
                            label: isSale ? "Cliente" : "Proveedor",
                            span: 2,
                            value: partnerName
                                ? <DataCell.ContactLink contactId={partnerId} className="justify-start">{partnerName}</DataCell.ContactLink>
                                : null,
                        },
                        { label: "Fecha", value: date(order.date) },
                        { label: "Número", value: <span className="font-mono">{order.display_id ?? order.number}</span> },
                        { label: "Canal", value: text(order.channel_display), hidden: !isSale },
                        { label: "Sesión POS", value: text(order.pos_session_display), hidden: !isSale || !order.pos_session },
                        { label: "Bodega", value: text(order.warehouse_name), hidden: isSale },
                        { label: "OT asociada", value: text(order.work_order_number), hidden: isSale || !order.work_order_number },
                    ]}
                />
            </section>

            <section className="space-y-4">
                <FormSection title="Condiciones" icon={Scale} />
                <DocumentFieldGrid
                    fields={[
                        { label: "Forma de pago", value: text(order.payment_method_ref_name) ?? text(order.payment_method) },
                        { label: isSale ? "Fecha de entrega" : "Fecha de recepción", value: date(isSale ? order.delivery_date : order.receipt_date) },
                        { label: isSale ? "Entrega" : "Recepción", value: status(isSale ? order.delivery_status : order.receiving_status) },
                        { label: "Facturación", value: status(order.invoicing_status) },
                        { label: "Origen del crédito", value: text(order.credit_assignment_origin_display), hidden: !isSale || !order.credit_assignment_origin },
                    ]}
                />
            </section>

            <section className="space-y-4">
                <FormSection title="Totales" icon={Banknote} />
                <DocumentFieldGrid
                    className="tabular-nums"
                    fields={[
                        { label: "Neto", value: money(order.total_net) },
                        { label: "Descuento", value: money(order.total_discount_amount), hidden: !Number(order.total_discount_amount) },
                        { label: "Impuestos", value: money(order.total_tax) },
                        { label: "Total", value: <span className="font-bold">{money(order.effective_total ?? order.total)}</span> },
                        { label: "Pagado", value: money(order.total_paid) },
                        { label: "Saldo", value: money(order.pending_amount) },
                    ]}
                />
            </section>

            <section className="space-y-4">
                <FormSection title="Ciclo de vida" icon={CalendarClock} />
                <DocumentFieldGrid
                    fields={[
                        { label: "Estado", value: status(order.status) },
                        { label: "Creada", value: typeof order.created_at === "string" ? <DataCell.Date value={order.created_at} showTime size="xs" /> : null },
                        { label: "Actualizada", value: typeof order.updated_at === "string" ? <DataCell.Date value={order.updated_at} showTime size="xs" /> : null },
                        { label: "Notas", value: text(order.notes), span: 4 },
                    ]}
                />
            </section>
        </div>
    )
}
