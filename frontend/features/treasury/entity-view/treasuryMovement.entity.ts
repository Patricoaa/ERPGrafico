import { defineEntity } from "@/components/entity-view"
import { resolveTreasuryMovementIcon } from "@/lib/movement-icons"
import { movementEndpoints } from "../lib/movementPath"
import "./movementPath"
import type { TreasuryMovement } from "../types"

/** Cash/bank movements (ADR-0087 oleada C1). One entity for TreasuryMovementsClientView and the
 * bank-filtered BankMovementsClientView (same hook, same fields — only the server filter differs). */
export const treasuryMovementEntity = defineEntity<TreasuryMovement>()((f) => ({
    label: "treasury.treasurymovement",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        movementType: f.status((m) => {
            if (m.payment_method === "WRITE_OFF") return { status: "voided", label: "Castigo", intent: "neutral" }
            if (m.movement_type === "INBOUND") return { status: "received", label: "Depósito", intent: "success" }
            if (m.movement_type === "OUTBOUND") return { status: "sent", label: "Retiro", intent: "destructive" }
            if (m.movement_type === "TRANSFER") return { status: "in_progress", label: "Traspaso", intent: "primary" }
            return { status: "in_progress", label: "Ajuste", intent: "warning" }
        }, { label: "Tipo", groupKey: "movement_type" }),
        date: f.date("date", { label: "Fecha", groupKey: "date" }),
        createdAt: f.date("created_at", { label: "Fecha y hora", time: true }),
        createdBy: f.text((m) => m.created_by_name ?? "", { label: "Responsable" }),
        reason: f.text((m) => [m.justify_reason_display, m.notes].filter(Boolean).join(" · "), { label: "Concepto / destino", tone: "secondary" }),
        paymentMethod: f.text((m) => m.payment_method_display ?? m.payment_method ?? "", { label: "Método", tone: "secondary", groupKey: "payment_method" }),
        accounts: f.value("movementPath", (m) => movementEndpoints(m), { label: "Cuentas" }),
        // No icon in the flow badge: the card rail already carries the entry/exit arrow, and the
        // shared CurrencyFlow glyph (↗/↙ trend) points the opposite way. Sign + color keep the meaning.
        amount: f.flow("amount", {
            label: "Monto",
            direction: (m) => (m.movement_type === "OUTBOUND" ? "outflow" : "inflow"),
            showIcon: false,
        }),
    },
    // ADR-0158 §3. No `sort`: the movements endpoint has no server ordering.
    // `treasury_account` / `bank` take their options from the screen (`filterOptions`).
    query: {
        search: { placeholder: "Buscar por contacto o referencia…", scopes: [{ field: "folio", param: "display_id" }] },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            movement_type: {
                field: "movementType",
                control: "single",
                options: [
                    { value: "INBOUND", label: "Depósito" },
                    { value: "OUTBOUND", label: "Retiro" },
                    { value: "TRANSFER", label: "Traspaso" },
                    { value: "ADJUSTMENT", label: "Ajuste" },
                ],
            },
            payment_method: {
                field: "paymentMethod",
                control: "single",
                options: [
                    { value: "CASH", label: "Efectivo" },
                    { value: "CARD_TERMINAL", label: "Tarjeta (terminal de cobro)" },
                    { value: "CARD", label: "Tarjeta (Manual)" },
                    { value: "TRANSFER", label: "Transferencia" },
                    { value: "CHECK", label: "Cheque" },
                    { value: "DEBIT_CARD", label: "Tarjeta Débito Empresa" },
                    { value: "CREDIT_CARD", label: "Tarjeta Crédito Empresa" },
                    { value: "CREDIT", label: "Crédito" },
                    { value: "WRITE_OFF", label: "Castigo de Deuda" },
                    { value: "CREDIT_BALANCE", label: "Saldo a Favor" },
                    { value: "OTHER", label: "Otro" },
                ],
            },
            amount: { field: "amount", control: "range", paramFrom: "amount_min", paramTo: "amount_max" },
            treasury_account: { label: "Cuenta", control: "single", options: "remote" },
            bank: { label: "Banco", control: "single", options: "remote" },
        },
        groupBy: { fields: ["date", "movementType", "paymentMethod"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "inbound", label: "Depósitos", filters: { movement_type: "INBOUND" } },
            { id: "outbound", label: "Retiros", filters: { movement_type: "OUTBOUND" } },
            { id: "transfers", label: "Traspasos", filters: { movement_type: "TRANSFER" } },
        ],
    },
}))

export const treasuryMovementViews = treasuryMovementEntity.views({
    table: { columns: ["folio", "movementType", "date", "paymentMethod", "accounts", "amount"], primary: "folio" },
    card: {
        rail: {
            status: (m) => {
                if (m.payment_method === "WRITE_OFF") return "CANCELLED"
                if (m.movement_type === "INBOUND") return "SUCCESS"
                if (m.movement_type === "OUTBOUND") return "DESTRUCTIVE"
                if (m.movement_type === "TRANSFER") return "PRIMARY"
                return "WARNING"
            },
        },
        title: "folio",
        subtitle: ["paymentMethod", "date"],
        trailing: ["amount"],
        meta: ["accounts"],
        media: {
            iconFor: (m) => resolveTreasuryMovementIcon(m).icon,
            tone: (m) => (m.payment_method === "WRITE_OFF" ? "muted" : m.movement_type === "INBOUND" ? "success" : m.movement_type === "OUTBOUND" ? "destructive" : m.movement_type === "TRANSFER" ? "primary" : "warning"),
        },
    },
})
