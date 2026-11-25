import { defineEntity, formatDate, toNumber, type StatusValue } from "@/components/entity-view"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import { FISCAL_MATCH_STATUS_OPTIONS, fiscalMatchRefValue, type FiscalMatchRef } from "@/lib/fiscal-match"
import type { TerminalSale, TerminalSalePaymentType, TerminalSaleStatus } from "../types"

export const TERMINAL_SALE_PAYMENT_TYPE_LABELS: Record<TerminalSalePaymentType, string> = {
    CASH: "Efectivo",
    DEBIT: "Débito",
    CREDIT: "Crédito",
    PREPAID: "Prepago",
    UNKNOWN: "Sin tipo",
}

/** "<código SII> · <nombre>" (p. ej. "39 · Boleta Electrónica"); vacío sin código. */
export function formatDteType(code: number | null, label: string): string {
    if (code === null) return ""
    return label ? `${code} · ${label}` : String(code)
}

export const TERMINAL_SALE_STATUS_LABELS: Record<TerminalSaleStatus, string> = {
    COMPLETED: "Completada",
    REVERSED: "Anulada",
    OTHER: "Otro",
}

const STATUS_INTENTS: Record<TerminalSaleStatus, BadgeIntent> = {
    COMPLETED: "success",
    REVERSED: "destructive",
    OTHER: "neutral",
}

export function terminalSaleStatus(status: TerminalSaleStatus): StatusValue {
    return { status: status.toLowerCase(), label: TERMINAL_SALE_STATUS_LABELS[status], intent: STATUS_INTENTS[status] }
}

export function terminalSalePaymentType(paymentType: TerminalSalePaymentType): StatusValue {
    return {
        status: paymentType.toLowerCase(),
        label: TERMINAL_SALE_PAYMENT_TYPE_LABELS[paymentType],
        intent: paymentType === "UNKNOWN" ? "warning" : "neutral",
    }
}

/** Cuadre de la venta: estado de su grupo; prefiere el texto del backend. */
export function terminalSaleMatchStatus(fiscalMatch: FiscalMatchRef | null): StatusValue {
    return fiscalMatchRefValue(fiscalMatch)
}

/** Settlement column/detail text: the deposit date, or "Pendiente" while TUU has not settled it. */
export function terminalSaleSettlement(settlementDate: string | null): string {
    return settlementDate ? formatDate(settlementDate) : "Pendiente"
}

/** Read-only mirror of TUU terminal sales (spec 2026-11-13). */
export const terminalSaleEntity = defineEntity<TerminalSale>()((f) => ({
    label: "treasury.terminalsale",
    fields: {
        transactionAt: f.date("transaction_at", { label: "Fecha", time: true }),
        saleId: f.code("sale_id", { label: "ID venta" }),
        sequenceNumber: f.code("sequence_number", { label: "N° secuencia" }),
        provider: f.text("provider_name", { label: "Proveedor" }),
        device: f.text((s) => s.device_name ?? s.serial_number, { label: "Terminal" }),
        paymentType: f.status((s) => terminalSalePaymentType(s.payment_type), { label: "Tipo de pago" }),
        documentType: f.text((s) => formatDteType(s.document_type, s.document_type_label), { label: "Documento" }),
        cardBrand: f.text("card_brand", { label: "Marca" }),
        cardIssuer: f.text("card_issuer", { label: "Emisor" }),
        totalAmount: f.money("total_amount", { label: "Total" }),
        commissionAmount: f.money(
            (s) => (s.commission_amount === null ? null : -Math.abs(toNumber(s.commission_amount) ?? 0)),
            { label: "Comisión" },
        ),
        netAmount: f.money("net_amount", { label: "Neto" }),
        settlementDate: f.text((s) => terminalSaleSettlement(s.settlement_date), { label: "Abono" }),
        status: f.status((s) => terminalSaleStatus(s.status), { label: "Estado" }),
        matchStatus: f.status((s) => terminalSaleMatchStatus(s.fiscal_match), { label: "Cuadre" }),
    },
    // ADR-0158 §3. No `sort`: the sales endpoint has no server ordering. `provider` options come from the screen.
    query: {
        // The endpoint has no text search.
        search: false,
        filters: {
            date: { field: "transactionAt", control: "date", paramFrom: "date_from", paramTo: "date_to", presets: ["today", "last_7_days", "this_week", "this_month", "this_quarter", "this_year"] },
            provider: { field: "provider", control: "single", options: "remote" },
            payment_type: {
                field: "paymentType",
                control: "single",
                options: [
                    { value: "CASH", label: "Efectivo" },
                    { value: "DEBIT", label: "Débito" },
                    { value: "CREDIT", label: "Crédito" },
                    { value: "PREPAID", label: "Prepago" },
                    { value: "UNKNOWN", label: "Sin tipo" },
                ],
            },
            document_type: {
                field: "documentType",
                control: "single",
                options: [
                    { value: "33", label: "33 · Factura Electrónica" },
                    { value: "34", label: "34 · Factura Exenta" },
                    { value: "39", label: "39 · Boleta Electrónica" },
                    { value: "41", label: "41 · Boleta Exenta" },
                    { value: "48", label: "48 · Comprobante de Pago Electrónico" },
                    { value: "56", label: "56 · Nota de Débito" },
                    { value: "61", label: "61 · Nota de Crédito" },
                ],
            },
            status: { field: "status", control: "single", options: [{ value: "COMPLETED", label: "Completada" }, { value: "REVERSED", label: "Anulada" }, { value: "OTHER", label: "Otro" }] },
            // Fiscal match group status of the sale (ADR-0141).
            fiscal_match_status: { field: "matchStatus", control: "single", options: FISCAL_MATCH_STATUS_OPTIONS },
        },
    },
}))

export const terminalSaleViews = terminalSaleEntity.views({
    table: {
        columns: [
            "transactionAt", "saleId", "paymentType", "documentType", "cardIssuer",
            "totalAmount", "commissionAmount", "netAmount", "settlementDate", "status", "matchStatus",
        ],
        primary: "saleId",
    },
    card: {
        rail: { status: (r) => r.status },
        title: "saleId",
        subtitle: ["transactionAt"],
        trailing: ["totalAmount"],
        meta: ["paymentType", "documentType", "netAmount", "settlementDate", "status"],
    },
})

// ─── Detail sub-collections (embedded in TerminalSaleDrawer) ─────────────────

export interface TerminalSaleItemRow {
    id: number
    code: string | null
    name: string
    quantity: number | null
    price: number | null
}

export interface TerminalSaleReconciliationRow {
    id: number
    paymentDate: string | null
    installmentNumber: number | null
    amount: number | null
    reconciliationId: string | null
}

const asText = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : typeof v === "number" ? String(v) : null)
const asNumber = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }
    return null
}

/** Raw TUU item JSON → typed row. */
export function toTerminalSaleItemRows(items: readonly Record<string, unknown>[]): TerminalSaleItemRow[] {
    return items.map((item, i) => ({
        id: i + 1,
        code: asText(item.code),
        name: asText(item.name) ?? "",
        quantity: asNumber(item.quantity),
        price: asNumber(item.price),
    }))
}

/** Raw TUU reconciliation JSON → typed row. */
export function toTerminalSaleReconciliationRows(recs: readonly Record<string, unknown>[]): TerminalSaleReconciliationRow[] {
    return recs.map((rec, i) => ({
        id: i + 1,
        paymentDate: asText(rec.paymentDate),
        installmentNumber: asNumber(rec.installmentNumber),
        amount: asNumber(rec.amount),
        reconciliationId: asText(rec.reconciliationId),
    }))
}

const fixed = { sortable: false } as const

export const terminalSaleItemEntity = defineEntity<TerminalSaleItemRow>()((f) => ({
    title: "Ítems de la venta",
    fields: {
        code: f.code("code", { ...fixed, label: "Código" }),
        name: f.text("name", { ...fixed, label: "Descripción" }),
        quantity: f.number("quantity", { ...fixed, label: "Cantidad" }),
        price: f.money("price", { ...fixed, label: "Precio" }),
    },
}))

export const terminalSaleItemViews = terminalSaleItemEntity.views({
    table: { columns: ["code", "name", "quantity", "price"] },
})

export const terminalSaleReconciliationEntity = defineEntity<TerminalSaleReconciliationRow>()((f) => ({
    title: "Abonos de la venta",
    fields: {
        paymentDate: f.date("paymentDate", { ...fixed, label: "Fecha de abono" }),
        installmentNumber: f.number("installmentNumber", { ...fixed, label: "Cuota" }),
        amount: f.money("amount", { ...fixed, label: "Monto" }),
        reconciliationId: f.code("reconciliationId", { ...fixed, label: "ID abono" }),
    },
}))

export const terminalSaleReconciliationViews = terminalSaleReconciliationEntity.views({
    table: { columns: ["paymentDate", "installmentNumber", "amount", "reconciliationId"] },
})
