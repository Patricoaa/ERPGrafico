import { DataCell, createEntityActions } from '@/components/shared'
import type { StockMove } from './components/MovementClientView'
import { Eye } from "lucide-react"

export interface StockMoveActionsCtx {
    onViewDetails: (id: number) => void
}

export const stockMoveActions = createEntityActions<
    StockMove,
    StockMoveActionsCtx
>((item, ctx) => (
    <DataCell.Action
        icon={Eye}
        title="Ver Detalles"
        color="text-primary"
        onClick={() => ctx.onViewDetails(item.id)}
    />
))
