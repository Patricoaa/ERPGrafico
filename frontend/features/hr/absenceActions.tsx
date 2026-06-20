import { DataCell, createEntityActions } from '@/components/shared'
import type { Absence } from '@/types/hr'

export interface AbsenceActionsCtx {
    onEdit: (absence: Absence) => void
    onDelete: (id: number) => void
}

export const absenceActions = createEntityActions<
    Absence,
    AbsenceActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id)} />
    </>
))
