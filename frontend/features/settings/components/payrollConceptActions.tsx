import { DataCell, createEntityActions } from '@/components/shared'
import type { PayrollConcept } from '@/types/hr'

export interface PayrollConceptActionsCtx {
    onEdit: (concept: PayrollConcept) => void
    onDelete: (id: number) => void
}

export const payrollConceptActions = createEntityActions<
    PayrollConcept,
    PayrollConceptActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
        {!item.is_system && (
            <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id)} />
        )}
    </>
))
