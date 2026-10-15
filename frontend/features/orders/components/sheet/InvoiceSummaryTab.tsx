"use client"

import { useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable, DocumentFieldGrid, FormSection } from "@/components/shared"
import { DocumentRefLink } from "@/features/documents"
import { invoiceLineFields } from "../../invoiceLineFields"
import type { Order, OrderLine } from "../../types"
import { DocumentTotalsBox, toNumber } from "./DocumentTotalsBox"

/** Las celdas DataCell se centran por defecto; en la ficha van a la izquierda. */
const LEFT = "w-auto justify-start text-left"

function originOf(invoice: Order): { label: string; id: number; display: string; title: string } | null {
    const corrected = invoice.corrected_invoice
    if (corrected?.id) {
        return { label: "billing.invoice", id: Number(corrected.id), display: String(corrected.display_id ?? corrected.number ?? `#${corrected.id}`), title: "Documento corregido" }
    }
    if (typeof invoice.sale_order === "number") {
        return { label: "sales.saleorder", id: invoice.sale_order, display: String(invoice.sale_order_number ?? `OV #${invoice.sale_order}`), title: "Orden de venta" }
    }
    if (typeof invoice.purchase_order === "number") {
        return { label: "purchasing.purchaseorder", id: invoice.purchase_order, display: String(invoice.purchase_order_number ?? `OC #${invoice.purchase_order}`), title: "Orden de compra" }
    }
    return null
}

/** Fecha del documento con hora de creación cuando coinciden (mismo criterio que la OV). */
function dateTime(invoice: Order): { value: string; showTime: boolean } | null {
    const created = typeof invoice.created_at === "string" ? invoice.created_at : null
    if (!invoice.date) return created ? { value: created, showTime: true } : null
    if (created && new Date(created).toLocaleDateString("sv-SE") === invoice.date) return { value: created, showTime: true }
    return { value: invoice.date, showTime: false }
}

/**
 * Tab Resumen de la ficha de factura/nota (ADR-0083): Contexto en una fila (contraparte,
 * fecha y hora, documento y folio, origen) y Productos (tabla + totales).
 */
export function InvoiceSummaryTab({ invoice }: { invoice: Order }) {
    const isSale = invoice.is_sale_document === true || !!invoice.sale_order
    const partnerId = typeof invoice.partner_id === "number" ? invoice.partner_id : undefined
    const origin = originOf(invoice)
    const when = dateTime(invoice)
    const hasFolio = !!invoice.number && invoice.number !== "Draft"

    const lines: OrderLine[] = invoice.lines ?? invoice.items ?? []
    const columns = useMemo(() => invoiceLineFields.toColumns(), [])
    const subtotal = lines.reduce((sum, line) => sum + toNumber(line.subtotal_net ?? line.subtotal), 0)
    const total = toNumber(invoice.total)
    const pending = toNumber(invoice.pending_amount)

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid
                    fields={[
                        {
                            label: isSale ? "Cliente" : "Proveedor",
                            value: invoice.partner_name
                                ? <DataCell.ContactLink contactId={partnerId} className={LEFT}>{invoice.partner_name}</DataCell.ContactLink>
                                : null,
                        },
                        {
                            label: "Fecha",
                            value: when ? <DataCell.Date value={when.value} showTime={when.showTime} size="xs" className={LEFT} /> : null,
                        },
                        {
                            label: "Documento",
                            value: (
                                <span>
                                    {invoice.dte_type_display ?? invoice.dte_type}
                                    <span className="text-muted-foreground"> · </span>
                                    {hasFolio
                                        ? <span className="font-mono">Folio {invoice.number}</span>
                                        : <span className="text-muted-foreground">Folio pendiente</span>}
                                </span>
                            ),
                        },
                        {
                            label: origin?.title ?? "Origen",
                            value: origin ? <DocumentRefLink label={origin.label} id={origin.id} display={origin.display} /> : null,
                        },
                    ]}
                />
            </section>

            <section className="space-y-4">
                <FormSection title="Productos" icon={Package} />
                <DataTable columns={columns} data={lines} variant="minimal" />
                <DocumentTotalsBox
                    subtotal={subtotal}
                    tax={toNumber(invoice.total_tax)}
                    total={total}
                    paid={Math.max(0, total - pending)}
                    pending={pending}
                />
            </section>
        </div>
    )
}
