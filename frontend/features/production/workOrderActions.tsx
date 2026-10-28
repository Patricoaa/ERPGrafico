import { createEntityActions } from '@/components/shared'
import type { StructuredAction } from '@/components/shared'
import type { WorkOrder } from './types'

// deletion-policy: a WorkOrder is annulled, never hard-deleted.
export interface WorkOrderActionsCtx {
    onEdit: (id: number) => void
    onDuplicate: (id: number) => void
    onAnnul: (id: number) => void
}

export const workOrderActionItems = (order: WorkOrder, ctx: WorkOrderActionsCtx): StructuredAction[] => {
    const canAnnul = !['FINISHED', 'CANCELLED'].includes(order.status) && order.is_cancellable !== false

    return [
        { action: "edit", onClick: () => ctx.onEdit(order.id) },
        { action: "duplicate", onClick: () => ctx.onDuplicate(order.id) },
        { action: "annul", onClick: () => ctx.onAnnul(order.id), visible: canAnnul },
    ]
}

export const workOrderActions = createEntityActions<WorkOrder, WorkOrderActionsCtx>(workOrderActionItems)
