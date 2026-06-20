import { DataCell, createEntityActions } from '@/components/shared'
import type { TreasuryMovement } from '@/features/treasury/types'

export interface TreasuryMovementActionsCtx {
    onDetail: (id: number) => void
}

export const treasuryMovementActions = createEntityActions<
    TreasuryMovement,
    TreasuryMovementActionsCtx
>((item, ctx) => (
    <DataCell.Action action="detail" onClick={() => ctx.onDetail(item.id)} />
))
