import { createEntityActions } from '@/components/shared'
import type { StockMove } from './stockMoveFields'

export interface StockMoveActionsCtx {
    onViewDetails: (id: number) => void
}

export const stockMoveActions = createEntityActions<
    StockMove,
    StockMoveActionsCtx
>((item, ctx) => [
    {
        action: "detail",
        label: "Ver Detalles",
        iconColor: "text-primary",
        onClick: () => ctx.onViewDetails(item.id),
    },
])
