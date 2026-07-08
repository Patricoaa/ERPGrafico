import type { WorkOrder, WorkOrderSideEffects } from '../types'

export interface SideEffectsCheck {
    blocked: boolean
    reason?: string
}

/**
 * Determines whether rewinding to `targetStage` is blocked by existing side-effects.
 *
 * Prefers the `side_effects` field from the backend serializer (Phase 4) when present;
 * otherwise falls back to client-visible order data.
 */
export function hasSideEffects(order: WorkOrder): SideEffectsCheck {
    if (order.side_effects) {
        return fromBackendSideEffects(order.side_effects)
    }
    return fromClientData(order)
}

function fromBackendSideEffects(se: WorkOrderSideEffects): SideEffectsCheck {
    const reasons: string[] = []
    if (se.has_confirmed_pos) reasons.push('OC confirmadas')
    if (se.has_stock_movements) reasons.push('movimientos de stock')
    if (se.completed_tasks_count > 0)
        reasons.push(`${se.completed_tasks_count} tarea(s) completada(s)`)
    if (se.manually_edited_materials_count > 0)
        reasons.push('materiales editados manualmente')

    if (reasons.length === 0) return { blocked: false }
    return {
        blocked: true,
        reason: `Retroceso bloqueado: ${reasons.join(', ')}.`,
    }
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
