import { createEntityFields } from "@/components/shared"
import type { BankStatement } from "./types"

export const statementFields = createEntityFields<BankStatement>()({
    display_id: { key: "display_id", type: "code", label: "Folio" },
    treasury_account_name: { key: "treasury_account_name", type: "text", label: "Cuenta" },
    statement_date: { key: "statement_date", type: "date", label: "Fecha" },
    opening_balance: {
        key: "opening_balance",
        type: "currency",
        label: "Apertura",
        cellProps: { intent: "muted" },
        tableOptions: { align: "right" },
    },
    closing_balance: {
        key: "closing_balance",
        type: "currency",
        label: "Cierre",
        tableOptions: { align: "right" },
    },
    state: { key: "state", type: "status", label: "Estado", getLabel: (e) => e.state_display },
    reconciliation_progress: { key: "reconciliation_progress", type: "progress", label: "Progreso" },
})
