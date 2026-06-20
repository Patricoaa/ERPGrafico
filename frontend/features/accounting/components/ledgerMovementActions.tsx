import { DataCell, createEntityActions } from '@/components/shared'
import { Eye, Trash2 } from 'lucide-react'
import type { LedgerMovement } from '@/features/accounting/types'

export interface LedgerMovementActionsCtx {
    onViewEntry: (entryId: number) => void
    onDeleteEntry: (entryId: number) => void
}

export const ledgerMovementActions = createEntityActions<LedgerMovement, LedgerMovementActionsCtx>((mov, ctx) => (
    <>
        <DataCell.Action
            icon={Eye}
            title="Ver Asiento"
            color="text-primary"
            onClick={() => ctx.onViewEntry(mov.entry_id)}
        />
        <DataCell.Action
            icon={Trash2}
            title="Eliminar Asiento"
            className="text-destructive"
            onClick={() => ctx.onDeleteEntry(mov.entry_id)}
        />
    </>
))
