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
        }, { label: "Tipo" }),
        date: f.date("date", { label: "Fecha" }),
        paymentMethod: f.text((m) => m.payment_method_display ?? m.payment_method ?? "", { label: "Método", tone: "secondary" }),
        accounts: f.value("movementPath", (m) => movementEndpoints(m), { label: "Cuentas" }),
        // No icon in the flow badge: the card rail already carries the entry/exit arrow, and the
        // shared CurrencyFlow glyph (↗/↙ trend) points the opposite way. Sign + color keep the meaning.
        amount: f.flow("amount", {
            label: "Monto",
            direction: (m) => (m.movement_type === "OUTBOUND" ? "outflow" : "inflow"),
            showIcon: false,
        }),
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
