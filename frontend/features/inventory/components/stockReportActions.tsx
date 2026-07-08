import { DataCell, createEntityActions } from '@/components/shared'
import { ArrowRightLeft, History } from 'lucide-react'

export interface StockReportActionsCtx {
    onAdjust: (product: unknown) => void
    onHistory: (product: unknown) => void
}

export const stockReportActions = createEntityActions<unknown, StockReportActionsCtx>((item, ctx) => (
    <>
        <DataCell.Action icon={ArrowRightLeft} title="Ajustar Stock" onClick={() => ctx.onAdjust(item)} />
        <DataCell.Action icon={History} title="Ver Historial" onClick={() => ctx.onHistory(item)} />
    </>
))
