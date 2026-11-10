import { saleOrderEntity } from "@/features/sales"
import { treasuryMovementEntity } from "./treasuryMovement.entity"

/**
 * Embedded lists of the POS session sheet (ADR-0087): same entities as the sales/treasury
 * collections, composed with a compact table per surface. No hand-written tables.
 */
export const posSessionSalesViews = saleOrderEntity.views({
    table: { columns: ["folio", "customer", "date", "hub", "total"], footer: { sum: ["total"] } },
})

export const posSessionMovementViews = treasuryMovementEntity.views({
    table: { columns: ["date", "movementType", "paymentMethod", "accounts", "amount"] },
})
