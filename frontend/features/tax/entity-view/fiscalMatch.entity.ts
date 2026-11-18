import { defineEntity, formatMoneyValue } from "@/components/entity-view"
import { fiscalMatchStatusValue } from "@/lib/fiscal-match"
import type { FiscalMatchListItem } from "../types/fiscalMatch"
import { fiscalMatchPart, type FiscalMatchPartValue } from "./fiscalMatchPart.kind"

/** Nombre corto del tipo de documento, como en la página: «Boleta 39», «Factura 33». */
const DTE_SHORT: Record<number, string> = {
    33: "Factura",
    34: "Factura exenta",
    39: "Boleta",
    41: "Boleta exenta",
    46: "Factura de compra",
    48: "Comprobante",
    56: "Nota de débito",
    61: "Nota de crédito",
}

const RCV_FOLIOS_SHOWN = 2

/** «Boleta 39», «Factura 33»; null si el tipo no tiene nombre corto. */
export function dteShortLabel(dteType: number | null): string | null {
    const short = dteType === null ? undefined : DTE_SHORT[dteType]
    return short ? `${short} ${dteType}` : null
}

const withAmount = (label: string, amount: string | null): string =>
    amount === null ? label : `${label} · ${formatMoneyValue(amount)}`

/** ERP: «Boleta 39 · $12.500», o «(sin documento)» en un grupo huérfano. */
export function erpPart(row: FiscalMatchListItem): FiscalMatchPartValue {
    if (!row.invoice) return { state: row.erp_state, text: "(sin documento)" }
    const label = dteShortLabel(row.dte_type) ?? row.invoice.display_id
    return { state: row.erp_state, text: withAmount(label, row.erp_amount) }
}

/** TUU: «2 ventas · $80.000»; sin ventas, solo el estado («No aplica», «Falta»). */
export function tuuPart(row: FiscalMatchListItem): FiscalMatchPartValue {
    const n = row.terminal_sales.length
    if (n === 0) return { state: row.tuu_state, text: null }
    const total = row.tuu_amount ?? String(row.terminal_sales.reduce((sum, s) => sum + Number(s.sale_amount), 0))
    return { state: row.tuu_state, text: withAmount(n === 1 ? "1 venta" : `${n} ventas`, total) }
}

/** RCV: «Folio 88213» o «Folio 1532, 1533, …»; sin registro, solo el estado. */
export function rcvPart(row: FiscalMatchListItem): FiscalMatchPartValue {
    const folios = row.rcv_documents.map((d) => d.folio)
    if (folios.length === 0) return { state: row.rcv_state, text: null }
    const shown = folios.slice(0, RCV_FOLIOS_SHOWN).join(", ")
    return { state: row.rcv_state, text: `Folio ${shown}${folios.length > RCV_FOLIOS_SHOWN ? ", …" : ""}` }
}

const fixed = { sortable: false } as const

/** Grupo de cuadre: documento ERP ↔ pagos TUU ↔ registro RCV del SII (ADR-0141). */
export const fiscalMatchEntity = defineEntity<FiscalMatchListItem>()((f) => ({
    title: "Cuadre",
    fields: {
        erp: fiscalMatchPart(f, erpPart, { ...fixed, label: "Documento ERP" }),
        direction: f.text((r) => (r.direction === "purchase" ? "Compra" : "Venta"), { ...fixed, label: "Dirección", tone: "secondary" }),
        tuu: fiscalMatchPart(f, tuuPart, { ...fixed, label: "Pagos TUU" }),
        rcv: fiscalMatchPart(f, rcvPart, { ...fixed, label: "RCV (SII)" }),
        issueDate: f.date("issue_date", { ...fixed, label: "Fecha" }),
        status: f.status((r) => fiscalMatchStatusValue(r.status, r.status_display), { ...fixed, label: "Estado" }),
    },
}))

/** Vista única: en compras, TUU muestra «No aplica» desde el estado de la parte. */
export const fiscalMatchViews = fiscalMatchEntity.views({
    table: { columns: ["erp", "direction", "tuu", "rcv", "issueDate", "status"], primary: "erp" },
    card: { title: "erp", subtitle: ["direction", "issueDate"], meta: ["tuu", "rcv"], trailing: ["status"] },
})
