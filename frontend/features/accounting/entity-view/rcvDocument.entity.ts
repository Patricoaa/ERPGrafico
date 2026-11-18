import { defineEntity, type StatusValue } from "@/components/entity-view"
import { fiscalMatchRefValue } from "@/lib/fiscal-match"
import type { RcvDocument } from "../types/rcv"

/** "<código SII> · <nombre>" (p. ej. "33 · Factura Electrónica"). */
export function formatRcvDteType(code: number, label: string): string {
    return label ? `${code} · ${label}` : String(code)
}

const ACK_RECEIVED = "Recibo otorgado por el receptor"

/** Acuse de recibo del SII (solo compras); sin valor si el SII no informó acuse. */
export function rcvAcknowledgementStatus(acknowledgement: string): StatusValue | null {
    if (!acknowledgement) return null
    const received = acknowledgement === ACK_RECEIVED
    return { status: received ? "received" : "unclaimed", label: acknowledgement, intent: received ? "success" : "neutral" }
}

/** Aviso de documento que dejó de venir en la última importación; sin valor si sigue vigente. */
export function rcvMissingStatus(doc: Pick<RcvDocument, "is_missing">): StatusValue | null {
    return doc.is_missing ? { status: "missing", label: "No vino en la última importación", intent: "warning" } : null
}

/** Read-only mirror of SII RCV documents (spec 2026-11-14). Purchases and sales share the entity. */
export const rcvDocumentEntity = defineEntity<RcvDocument>()((f) => ({
    label: "accounting.rcvdocument",
    fields: {
        issueDate: f.date("issue_date", { label: "Emisión" }),
        dteType: f.text((d) => formatRcvDteType(d.dte_type, d.dte_type_label), { label: "Tipo de documento" }),
        folio: f.code((d) => String(d.folio), { label: "Folio" }),
        counterpartyRut: f.code("counterparty_rut", { label: "RUT" }),
        supplierName: f.text("counterparty_name", { label: "Proveedor" }),
        customerName: f.text("counterparty_name", { label: "Cliente" }),
        net: f.money("net_amount", { label: "Neto" }),
        vatRecoverable: f.money("vat_recoverable", { label: "IVA" }),
        vatAmount: f.money("vat_amount", { label: "IVA" }),
        total: f.money("total_amount", { label: "Total" }),
        acknowledgement: f.status((d) => rcvAcknowledgementStatus(d.acknowledgement), { label: "Acuse" }),
        receivedAt: f.date("received_at", { label: "Recepción SII", time: true }),
        missing: f.status((d) => rcvMissingStatus(d), { label: "Vigencia" }),
        matchStatus: f.status((d) => fiscalMatchRefValue(d.fiscal_match), { label: "Cuadre" }),
    },
}))

export const rcvPurchaseViews = rcvDocumentEntity.views({
    table: {
        columns: [
            "issueDate", "dteType", "folio", "counterpartyRut", "supplierName",
            "net", "vatRecoverable", "total", "acknowledgement", "matchStatus", "receivedAt", "missing",
        ],
        primary: "folio",
    },
    card: {
        rail: { status: (r) => (r.is_missing ? "WARNING" : "SUCCESS") },
        title: "supplierName",
        subtitle: ["issueDate", "folio"],
        trailing: ["total"],
        meta: ["dteType", "counterpartyRut", "net", "vatRecoverable", "acknowledgement", "matchStatus", "missing"],
    },
})

export const rcvSaleViews = rcvDocumentEntity.views({
    table: {
        columns: [
            "issueDate", "dteType", "folio", "counterpartyRut", "customerName",
            "net", "vatAmount", "total", "matchStatus", "receivedAt", "missing",
        ],
        primary: "folio",
    },
    card: {
        rail: { status: (r) => (r.is_missing ? "WARNING" : "SUCCESS") },
        title: "customerName",
        subtitle: ["issueDate", "folio"],
        trailing: ["total"],
        meta: ["dteType", "counterpartyRut", "net", "vatAmount", "matchStatus", "missing"],
    },
})
