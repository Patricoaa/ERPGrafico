import { createEntityFields } from "@/components/shared"
import type { LedgerMovement } from "./types"

export const ledgerMovementFields = createEntityFields<LedgerMovement>()({
    date: {
        order: 10,
        key: "date",
        type: "date",
        label: "Fecha",
    },
    description: {
        order: 20,
        key: "description",
        type: "text",
        label: "Descripción",
        get: (m) => m.label || m.description,
    },
    debit: {
        order: 30,
        key: "debit",
        type: "currency",
        label: "Debe",
        showZeroAsDash: true,
    },
    credit: {
        order: 40,
        key: "credit",
        type: "currency",
        label: "Haber",
        showZeroAsDash: true,
    },
    balance: {
        order: 50,
        key: "balance",
        type: "currency",
        label: "Saldo",
    },
})
