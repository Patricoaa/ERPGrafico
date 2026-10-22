"use client"

import { Package } from "lucide-react"
import { DataCell, DocumentFieldGrid, FormSection } from "@/components/shared"
import { DocumentRefLink } from "@/features/documents"
import type { Order, OrderLine } from "../../types"
import { DocumentTotalsBox, toNumber } from "./DocumentTotalsBox"
import { DocumentLinesTable } from "./DocumentLinesTable"

/** Las celdas DataCell se centran por defecto; en la ficha van a la izquierda. */
const LEFT = "w-auto justify-start text-left"

/** Título de la fila de origen según el tipo del DocumentRef (`origin_document`, ADR-0086). */
const ORIGIN_TITLE: Record<string, string> = {
    "billing.invoice": "Documento corregido",
    "sales.saleorder": "Orden de venta",
    "purchasing.purchaseorder": "Orden de compra",
}

function originTitle(invoice: Order): string {
    const ref = invoice.origin_document as { label?: unknown } | null | undefined
    if (ref && typeof ref.label === "string") return ORIGIN_TITLE[ref.label] ?? "Origen"
    return "Origen"
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
    const when = dateTime(invoice)
    const hasFolio = !!invoice.number && invoice.number !== "Draft"

    const lines: OrderLine[] = invoice.lines ?? invoice.items ?? []
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
                            label: originTitle(invoice),
                            value: invoice.origin_document ? <DocumentRefLink documentRef={invoice.origin_document} /> : null,
                        },
                    ]}
                />
            </section>

            <section className="space-y-4">
                <FormSection title="Productos" icon={Package} />
                <DocumentLinesTable lines={lines} kind="invoice" />
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
