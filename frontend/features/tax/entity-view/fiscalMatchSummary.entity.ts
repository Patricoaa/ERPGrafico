import { defineEntity, type StatusValue } from "@/components/entity-view"
import type { MonthlySummaryRow, PendingIssueItem } from "../types/fiscalMatch"

/** Boletas y comprobantes que se cuadran por resumen mensual (spec §5.6). */
const SUMMARY_DTE_LABELS: Record<number, string> = {
    39: "39 · Boleta Electrónica",
    41: "41 · Boleta Exenta",
    48: "48 · Comprobante de pago electrónico",
}

/** Monto Decimal (string, escala variable) → número; `null` se conserva para mostrar «—». */
const amount = (value: string | null): number | null => (value === null ? null : Number(value))

const fixed = { sortable: false } as const

/**
 * Resumen mensual ERP · TUU · SII por tipo. «48 esperado» = comprobantes 48 del ERP + pagos TUU con
 * tarjeta de facturas del mes (TUU emite un 48 por cada uno); en 39/41 coincide con el ERP y no se repite.
 */
export const monthlySummaryEntity = defineEntity<MonthlySummaryRow>()((f) => ({
    title: "Resumen mensual de boletas y comprobantes",
    rowId: (row) => row.dte_type,
    fields: {
        dteType: f.text((r) => SUMMARY_DTE_LABELS[r.dte_type] ?? String(r.dte_type), { ...fixed, label: "Tipo de documento" }),
        erp: f.money((r) => amount(r.erp_total), { ...fixed, label: "ERP" }),
        tuu: f.money((r) => amount(r.tuu_total), { ...fixed, label: "TUU" }),
        expected48: f.money((r) => (r.dte_type === 48 ? amount(r.expected_total) : null), { ...fixed, label: "48 esperado" }),
        rcv: f.money((r) => amount(r.rcv_total), { ...fixed, label: "SII" }),
        difference: f.money((r) => amount(r.difference), { ...fixed, label: "Diferencia" }),
    },
}))

export const monthlySummaryViews = monthlySummaryEntity.views({
    table: { columns: ["dteType", "erp", "tuu", "expected48", "rcv", "difference"], primary: "dteType" },
})

const ERROR_PREVIEW_CHARS = 40

/** «Error al emitir» con un extracto corto; el texto completo va en la columna «Detalle». */
function errorLabel(error: string | null): string {
    const text = (error ?? "").trim()
    if (!text) return "Error al emitir"
    const preview = text.length > ERROR_PREVIEW_CHARS ? `${text.slice(0, ERROR_PREVIEW_CHARS).trimEnd()}…` : text
    return `Error al emitir: ${preview}`
}

/** Motivo de un borrador pendiente de folio, para `StatusBadge`. */
export function pendingIssueReason(doc: PendingIssueItem): StatusValue {
    switch (doc.reason) {
        case "NO_TUU":
            return { status: "NO_TUU", label: "Sin venta TUU", intent: "warning" }
        case "WAITING_RCV":
            return { status: "WAITING_RCV", label: "Esperando RCV", intent: "info" }
        case "MANY_FOLIOS":
            return { status: "MANY_FOLIOS", label: "Varios folios en el SII", intent: "warning" }
        case "ERROR":
            return { status: "ERROR", label: errorLabel(doc.error), intent: "destructive" }
        case "READY":
            return { status: "READY", label: "Lista para emitir", intent: "success" }
    }
}

/** Boletas y comprobantes en borrador a la espera de su número fiscal (ADR-0140). */
export const pendingIssueDocumentEntity = defineEntity<PendingIssueItem>()((f) => ({
    title: "Boletas pendientes de folio",
    fields: {
        label: f.text("label", { label: "Documento" }),
        date: f.date("date", { label: "Fecha" }),
        amount: f.money((r) => amount(r.amount), { label: "Monto" }),
        reason: f.status(pendingIssueReason, { label: "Motivo" }),
        error: f.text("error", { label: "Detalle", tone: "secondary" }),
    },
}))

export const pendingIssueDocumentViews = pendingIssueDocumentEntity.views({
    table: { columns: ["label", "date", "amount", "reason", "error"], primary: "label" },
    card: { title: "label", subtitle: ["date", "reason", "error"], trailing: ["amount"] },
})
