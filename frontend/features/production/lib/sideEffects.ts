import type { WorkOrder, WorkOrderSideEffects } from '../types'

export interface SideEffectsCheck {
    blocked: boolean
    reason?: string
}

/**
 * Determines whether rewinding to `targetStage` is blocked by existing side-effects
 * (purchase orders only block reopening the outsourcing that generated them).
 *
 * Prefers the `side_effects` field from the backend serializer (Phase 4) when present;
 * otherwise falls back to client-visible order data.
 */
export function hasSideEffects(order: WorkOrder, targetStage?: string): SideEffectsCheck {
    if (order.side_effects) {
        return fromBackendSideEffects(order.side_effects, targetStage)
    }
    return fromClientData(order)
}

/**
 * Only irreversible effects block a rewind. Completed approvals are reset by the
 * rewind itself and manually added materials are ordinary editable data, so
 * counting them (as this used to) disabled the rewind on every OT past its
 * first stage. The server enforces the same list in `transition_to`.
 */
function fromBackendSideEffects(se: WorkOrderSideEffects, targetStage?: string): SideEffectsCheck {
    const perStage = targetStage ? se.rewind_blockers_by_stage?.[targetStage] : undefined
    const blockers = perStage ?? se.rewind_blockers ?? [
        ...(se.has_confirmed_pos ? ['Existen Órdenes de Compra confirmadas.'] : []),
        ...(se.has_stock_movements ? ['Existen movimientos de stock.'] : []),
    ]
    if (blockers.length === 0) return { blocked: false }
    return { blocked: true, reason: `Retroceso bloqueado: ${blockers.join(' ')}` }
}

function fromClientData(order: WorkOrder): SideEffectsCheck {
    const hasConfirmedPO = (order.materials ?? []).some(
        (m) => m.is_outsourced && m.purchase_order_number
    )
    if (hasConfirmedPO) {
        return {
            blocked: true,
            reason: 'Existen Órdenes de Compra generadas para materiales tercerizados.',
        }
    }
    return { blocked: false }
}
