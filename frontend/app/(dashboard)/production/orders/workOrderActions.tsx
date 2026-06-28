import { DataCell, createEntityActions } from '@/components/shared'
import type { WorkOrder } from '@/features/production'

export interface WorkOrderActionsCtx {
    onEdit: (id: number) => void
    onDuplicate: (id: number) => void
    onAnnul: (id: number) => void
    onDelete: (id: number) => void
}

export const workOrderActions = createEntityActions<WorkOrder, WorkOrderActionsCtx>((order, ctx) => {
    const isEditable = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage)
    const canAnnul = !['DRAFT', 'FINISHED', 'CANCELLED'].includes(order.status)
    const overflow = [
        { action: 'duplicate' as const, onClick: () => ctx.onDuplicate(order.id) },
        ...(canAnnul ? [{ action: 'annul' as const, onClick: () => ctx.onAnnul(order.id) }] : []),
        ...(isEditable ? [{ action: 'delete' as const, onClick: () => ctx.onDelete(order.id) }] : []),
    ]
    return (
        <>
            <DataCell.Action
                action="edit"
                onClick={() => ctx.onEdit(order.id)}
            />
            <DataCell.ActionMenu items={overflow} />
        </>
    )
})
