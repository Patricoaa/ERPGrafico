import { createEntityFields } from "@/components/shared"
import type { LedgerMovement } from "./types"

export const ledgerMovementFields = createEntityFields<LedgerMovement>()({
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    description: {
        key: "description",
        type: "text",
        label: "Descripción",
        get: (m) => m.label || m.description,
    },
    debit: {
        key: "debit",
        type: "currency",
        label: "Debe",
        showZeroAsDash: true,
    },
    credit: {
        key: "credit",
        type: "currency",
        label: "Haber",
        showZeroAsDash: true,
    },
    balance: {
        key: "balance",
        type: "currency",
        label: "Saldo",
    },
})
