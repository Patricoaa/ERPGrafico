// Side-effect import: ensures the `ledgerDate` kind is registered before this entity renders.
import "@/features/accounting"

import { defineEntity } from "@/components/entity-view"
import type { PartnerTransaction } from "@/features/contacts"
import { partnerTxDirection } from "./partnerLedger.entity"

/**
 * Tipos que no se listan: CONTRIB_TRANSFER_IN/OUT son seguimiento interno de lo enterado, se crean junto a
 * TRANSFER_IN/OUT y duplicarían la fila. Todo lo demás (capital, resultados, préstamos) se muestra.
 */
export const HIDDEN_MOVEMENT_TYPES = ["CONTRIB_TRANSFER_IN", "CONTRIB_TRANSFER_OUT"]

export const isListedMovement = (type: string) => !HIDDEN_MOVEMENT_TYPES.includes(type)

/** Fila de movimiento del socio: el movimiento del libro sin el saldo corrido. */
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
