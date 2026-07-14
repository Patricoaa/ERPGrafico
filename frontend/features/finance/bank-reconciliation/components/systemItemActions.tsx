import { createEntityActions } from '@/components/shared'
import type { ReconciliationSystemItem } from '@/features/finance/bank-reconciliation/types'

export interface SystemItemActionsCtx {
    onSplit: (payment: ReconciliationSystemItem) => void
}

export const systemItemActions = createEntityActions<ReconciliationSystemItem, SystemItemActionsCtx>((item, ctx) => [
    {
        action: "split",
        className: "text-primary hover:text-primary/80",
        onClick: (e) => {
            e.stopPropagation();
            ctx.onSplit(item)
        },
    },
])
