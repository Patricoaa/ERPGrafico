import { createEntityActions } from '@/components/shared'

export interface StockReportActionsCtx {
    onHistory: (product: unknown) => void
}

export const stockReportActions = createEntityActions<unknown, StockReportActionsCtx>((item, ctx) => [
    { action: "history", label: "Ver Historial", onClick: () => ctx.onHistory(item) },
])
