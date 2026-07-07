import { DataCell, createEntityActions } from '@/components/shared'
import { Eye } from 'lucide-react'
import type { LedgerMovement } from '@/features/accounting/types'

export interface LedgerMovementActionsCtx {
    onViewEntry: (entryId: number) => void
}

export const ledgerMovementActions = createEntityActions<LedgerMovement, LedgerMovementActionsCtx>((mov, ctx) => (
    <>
        <DataCell.Action
            icon={Eye}
            title="Ver Asiento"
            color="text-primary"
            onClick={() => ctx.onViewEntry(mov.entry_id)}
        />
    </>
))
