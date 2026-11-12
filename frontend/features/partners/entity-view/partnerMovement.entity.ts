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
    "CAPITAL_RETURN",
]

/** Movimientos de resultados: retiros provisorios, dividendos y utilidades retenidas (pestaña Resultados). */
export const RESULTS_MOVEMENT_TYPES = [
    "PROV_WITHDRAWAL",
    "WITHDRAWAL",
    "DIVIDEND",
    "DIVIDEND_PAY",
    "RETAINED",
    "RETAINED_MOB",
    "LOSS_ABSORB",
]

/**
 * Tipos que a propósito solo aparecen en el libro. Todo tipo del backend debe estar en una de las tres listas
 * (lo verifica un test): un tipo nuevo obliga a decidir su pestaña.
 * - CONTRIB_TRANSFER_IN/OUT: seguimiento de lo enterado, se crean junto a TRANSFER_IN/OUT y duplicarían la fila.
 * - LOAN_IN/OUT y OTHER: préstamos y otros, no son capital ni resultados.
 */
export const OMITTED_MOVEMENT_TYPES = ["CONTRIB_TRANSFER_IN", "CONTRIB_TRANSFER_OUT", "LOAN_IN", "LOAN_OUT", "OTHER"]

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
