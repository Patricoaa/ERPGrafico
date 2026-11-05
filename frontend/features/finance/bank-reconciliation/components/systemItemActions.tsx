import { createEntityActions, type StructuredAction } from '@/components/shared'
import { SplitSquareHorizontal } from 'lucide-react'
import type { ReconciliationSystemItem } from '@/features/finance/bank-reconciliation/types'

export interface SystemItemActionsCtx {
    onSplit: (payment: ReconciliationSystemItem) => void
}

/** Acciones de un movimiento de tesorería. Se usan tanto en `.auto()` como en la celda de la mesa (`RowActionsCell`). */
export function systemItemActionItems(item: ReconciliationSystemItem, ctx: SystemItemActionsCtx): StructuredAction[] {
    return [
        {
            action: "split",
            label: "Distribuir",
            icon: SplitSquareHorizontal,
            iconColor: "text-primary",
            onClick: (e) => { e.stopPropagation(); ctx.onSplit(item) },
        },
    ]
}

export const systemItemActions = createEntityActions<ReconciliationSystemItem, SystemItemActionsCtx>(systemItemActionItems)
