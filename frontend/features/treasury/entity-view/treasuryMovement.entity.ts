import { defineEntity } from "@/components/entity-view"
import { resolveTreasuryMovementIcon } from "@/lib/movement-icons"
import type { TreasuryMovement } from "../types"

/** Cash/bank movements (ADR-0087 oleada C1). One entity for TreasuryMovementsClientView and the
 * bank-filtered BankMovementsClientView (same hook, same fields — only the server filter differs). */
export const treasuryMovementEntity = defineEntity<TreasuryMovement>()((f) => ({
    label: "treasury.treasurymovement",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        movementType: f.status((m) => {
            if (m.payment_method === "WRITE_OFF") return { status: "voided", label: "Castigo" }
            if (m.movement_type === "INBOUND") return { status: "received", label: "Depósito" }
            if (m.movement_type === "OUTBOUND") return { status: "sent", label: "Retiro" }
            return { status: "in_progress", label: m.movement_type === "TRANSFER" ? "Traspaso" : "Ajuste" }
        }, { label: "Tipo" }),
        date: f.date("date", { label: "Fecha" }),
        paymentMethod: f.text((m) => m.payment_method_display ?? m.payment_method ?? "", { label: "Método", tone: "secondary" }),
        accounts: f.text((m) => {
            let source = m.from_account_name || "Origen"
            let dest = m.to_account_name || "Destino"
            if (m.movement_type === "INBOUND") {
                source = m.partner_name || "Particular"
                dest = m.to_account_name || "Caja"
            } else if (m.movement_type === "OUTBOUND") {
                source = m.from_account_name || "Caja"
                dest = m.partner_name || "Particular"
            }
            return `${source} → ${dest}`
        }, { label: "Cuentas" }),
        amount: f.flow("amount", { label: "Monto", direction: (m) => (m.movement_type === "OUTBOUND" ? "outflow" : "inflow") }),
    },
}))

export const treasuryMovementViews = treasuryMovementEntity.views({
    table: { columns: ["folio", "movementType", "date", "paymentMethod", "accounts", "amount"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "folio",
        subtitle: ["paymentMethod", "date"],
        trailing: ["amount"],
        meta: ["accounts"],
        media: {
            iconFor: (m) => resolveTreasuryMovementIcon(m).icon,
            tone: (m) => (m.payment_method === "WRITE_OFF" ? "muted" : m.movement_type === "INBOUND" ? "success" : m.movement_type === "OUTBOUND" ? "destructive" : "warning"),
        },
    },
})
