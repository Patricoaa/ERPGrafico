import { DataCell, createEntityActions } from '@/components/shared'
import { Eye } from 'lucide-react'
import type { PartnerTransaction } from '@/features/contacts/types/partner'

export interface PartnerTransactionActionsCtx {
    onViewMovement: (movementId: number) => void
}

export const partnerTransactionActions = createEntityActions<
    PartnerTransaction,
    PartnerTransactionActionsCtx
>((item, ctx) => {
    const movementId = item.treasury_movement
    return movementId ? (
        <DataCell.Action icon={Eye} title="Ver Detalle Transaccional" onClick={() => ctx.onViewMovement(movementId)} />
    ) : (
        <span className="text-[10px] text-muted-foreground italic">No vinculado</span>
    )
})
