import { defineEntity } from "@/components/entity-view"
import type { OnlyErpDocument, ReconciliationSummary } from "../types/reconciliation"

/** Boletas y comprobantes que se cuadran por resumen mensual (ADR-0138). */
const SUMMARY_DTE_LABELS: Record<number, string> = {
    39: "39 · Boleta Electrónica",
    41: "41 · Boleta Exenta",
    48: "48 · Comprobante de pago electrónico",
}

/** Monto Decimal (string, escala variable) → número; `null` se conserva para mostrar «—». */
const amount = (value: string | null): number | null => (value === null ? null : Number(value))

const fixed = { sortable: false } as const

/** Resumen mensual ERP · TUU · SII por tipo de boleta o comprobante. */
export const reconciliationSummaryEntity = defineEntity<ReconciliationSummary>()((f) => ({
    title: "Boletas y comprobantes",
    rowId: (row) => row.dte_type,
    fields: {
        dteType: f.text((r) => SUMMARY_DTE_LABELS[r.dte_type] ?? String(r.dte_type), { ...fixed, label: "Tipo de documento" }),
        erp: f.money((r) => amount(r.erp_total), { ...fixed, label: "ERP" }),
        tuu: f.money((r) => amount(r.tuu_total), { ...fixed, label: "TUU" }),
        rcv: f.money((r) => amount(r.rcv_total), { ...fixed, label: "SII" }),
        difference: f.money((r) => amount(r.difference), { ...fixed, label: "Diferencia" }),
        tuuWithoutRcv: f.number("tuu_without_rcv", { ...fixed, label: "Venta TUU sin boleta SII" }),
        rcvWithoutTuu: f.number("rcv_without_tuu", { ...fixed, label: "Boleta SII sin venta TUU" }),
    },
}))

export const reconciliationSummaryViews = reconciliationSummaryEntity.views({
    table: { columns: ["dteType", "erp", "tuu", "rcv", "difference", "tuuWithoutRcv", "rcvWithoutTuu"], primary: "dteType" },
})

/** Facturas y notas del ERP sin documento en el RCV del SII. */
export const onlyErpDocumentEntity = defineEntity<OnlyErpDocument>()((f) => ({
    title: "Falta en el SII",
    fields: {
        label: f.text("label", { label: "Documento" }),
        date: f.date("date", { label: "Fecha" }),
        amount: f.money((r) => amount(r.amount), { label: "Total" }),
    },
}))

export const onlyErpDocumentViews = onlyErpDocumentEntity.views({
    table: { columns: ["label", "date", "amount"], primary: "label" },
    card: { title: "label", subtitle: ["date"], trailing: ["amount"] },
})
