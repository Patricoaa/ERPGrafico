import { DataCell, createEntityActions } from '@/components/shared'
import type { SalaryAdvance } from '@/types/hr'

export interface SalaryAdvanceActionsCtx {
    onEdit: (advance: SalaryAdvance) => void
    onDelete: (id: number) => void
}

export const salaryAdvanceActions = createEntityActions<
    SalaryAdvance,
    SalaryAdvanceActionsCtx
>((item, ctx) => (
    <>
        {!item.is_discounted && (
            <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
        )}
        <DataCell.Action
            action="delete"
            onClick={() => {
                if (confirm("¿Eliminar anticipo? Esta acción no se puede deshacer.")) {
                    ctx.onDelete(item.id)
                }
            }}
        />
    </>
))
