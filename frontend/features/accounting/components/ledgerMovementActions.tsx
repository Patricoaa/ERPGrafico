import { createEntityActions } from '@/components/shared'
import type { LedgerMovement } from '@/features/accounting/types'

export interface LedgerMovementActionsCtx {
    onViewEntry: (entryId: number) => void
}

export const ledgerMovementActions = createEntityActions<LedgerMovement, LedgerMovementActionsCtx>((mov, ctx) => [
    {
        action: "detail",
        label: "Ver Asiento",
        iconColor: "text-primary",
        onClick: () => ctx.onViewEntry(mov.entry_id),
    },
])
