// Side-effect import: ensures the `ledgerDate` kind is registered before this entity renders.
import "@/features/accounting"

import { defineEntity } from "@/components/entity-view"
import type { PartnerTransaction } from "@/features/contacts"
import { partnerTxDirection } from "./partnerLedger.entity"

/** Movimientos que cambian la composición del capital (pestaña Capital de la ficha). */
export const CAPITAL_MOVEMENT_TYPES = [
    "SUBSCRIPTION",
    "REDUCTION",
    "CAPITAL_CASH",
    "CAPITAL_INVENTORY",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "REINVESTMENT",
]

/** Movimientos de resultados: retiros provisorios, dividendos y utilidades retenidas (pestaña Resultados). */
export const RESULTS_MOVEMENT_TYPES = [
    "PROV_WITHDRAWAL",
    "WITHDRAWAL",
    "DIVIDEND",
    "DIVIDEND_PAY",
    "RETAINED",
    "RETAINED_MOB",
]

export const isCapitalMovement = (type: string) => CAPITAL_MOVEMENT_TYPES.includes(type)
export const isResultsMovement = (type: string) => RESULTS_MOVEMENT_TYPES.includes(type)

/** Fila de movimiento de capital o resultados: el movimiento del libro sin el saldo corrido. */
export const partnerMovementEntity = defineEntity<PartnerTransaction>()((f) => ({
    title: "Movimientos",
    rowId: (tx) => tx.id,
    fields: {
        date: f.value("ledgerDate", (tx) => ({ date: tx.date, createdAt: tx.created_at }), { label: "Fecha" }),
        transactionType: f.text((tx) => tx.transaction_type_display, { label: "Tipo", tone: "secondary" }),
        description: f.text((tx) => tx.description, { label: "Descripción", sortable: false }),
        amount: f.flow("amount", { label: "Monto", direction: (tx) => partnerTxDirection(tx.transaction_type) }),
    },
}))

export const partnerMovementViews = partnerMovementEntity.views({
    table: {
        columns: ["date", "transactionType", "description", "amount"],
        primary: "date",
    },
})
