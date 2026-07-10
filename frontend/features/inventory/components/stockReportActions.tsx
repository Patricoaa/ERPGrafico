import { DataCell, createEntityActions } from '@/components/shared'
import { History } from 'lucide-react'

export interface StockReportActionsCtx {
    onHistory: (product: unknown) => void
}

export const stockReportActions = createEntityActions<unknown, StockReportActionsCtx>((item, ctx) => (
    <>
        <DataCell.Action icon={History} title="Ver Historial" onClick={() => ctx.onHistory(item)} />
    </>
))
