import { treasuryMovementEntity } from "./treasuryMovement.entity"

/**
 * Lista de movimientos de caja de la ficha de la sesión POS (ADR-0087): misma entidad que
 * tesorería, tabla compacta.
 */
export const posSessionMovementViews = treasuryMovementEntity.views({
    table: { columns: ["createdAt", "movementType", "reason", "createdBy", "amount"] },
})
