import { createEntityActions } from '@/components/shared'
import type { WorkOrder } from './types'

export interface WorkOrderActionsCtx {
    onEdit: (id: number) => void
    onDuplicate: (id: number) => void
    onAnnul: (id: number) => void
    onDelete: (id: number) => void
}

export const workOrderActions = createEntityActions<WorkOrder, WorkOrderActionsCtx>((order, ctx) => {
    const isEditable = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage)
    const canAnnul = !['DRAFT', 'FINISHED', 'CANCELLED'].includes(order.status)

    return [
        { action: "edit", onClick: () => ctx.onEdit(order.id) },
        { action: "duplicate", onClick: () => ctx.onDuplicate(order.id) },
        { action: "annul", onClick: () => ctx.onAnnul(order.id), visible: canAnnul },
        { action: "delete", onClick: () => ctx.onDelete(order.id), visible: isEditable },
    ]
})
