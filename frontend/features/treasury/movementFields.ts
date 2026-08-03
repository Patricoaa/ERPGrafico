import { createEntityFields } from "@/components/shared"
import type { TreasuryMovement } from "./types"

export const movementFields = createEntityFields<TreasuryMovement>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    movementType: {
        key: "movement_type",
        type: "status",
        label: "Tipo",
        get: (m) => {
            if (m.payment_method === 'WRITE_OFF') return "voided"
            if (m.movement_type === 'INBOUND') return "received"
            if (m.movement_type === 'OUTBOUND') return "sent"
            return "in_progress"
        },
        getLabel: (m) => {
            if (m.payment_method === 'WRITE_OFF') return "Castigo"
            if (m.movement_type === 'INBOUND') return "Depósito"
            if (m.movement_type === 'OUTBOUND') return "Retiro"
            return m.movement_type === 'TRANSFER' ? "Traspaso" : "Ajuste"
        },
        className: "uppercase font-bold tracking-tight",
    },
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    paymentMethod: {
        key: "payment_method",
        type: "text",
        label: "Método",
        get: (m) => m.payment_method_display ?? m.payment_method ?? "",
    },
    sourceDest: {
        key: "from_account",
        type: "sourceDest",
        label: "Cuentas",
        get: (m) => {
            let source = m.from_account_name || 'Origen'
            let dest = m.to_account_name || 'Destino'
            if (m.movement_type === 'INBOUND') {
                source = m.partner_name || 'Particular'
                dest = m.to_account_name || 'Caja'
            } else if (m.movement_type === 'OUTBOUND') {
                source = m.from_account_name || 'Caja'
                dest = m.partner_name || 'Particular'
            }
            return { source, dest }
        },
    },
    amount: {
        key: "amount",
        type: "currencyFlow",
        label: "Monto",
        direction: (m) => m.movement_type === "OUTBOUND" ? "outflow" : "inflow",
    },
})
