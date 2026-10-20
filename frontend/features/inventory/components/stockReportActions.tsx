import { createEntityActions } from '@/components/shared'
import type { StockReportItem } from '../entity-view/stockReport.entity'

export interface StockReportActionsCtx {
    onHistory: (product: StockReportItem) => void
}

export const stockReportActions = createEntityActions<StockReportItem, StockReportActionsCtx>((item, ctx) => [
    { action: "history", label: "Ver Historial", onClick: () => ctx.onHistory(item) },
])
