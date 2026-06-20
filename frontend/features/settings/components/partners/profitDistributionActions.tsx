import { DataCell, createEntityActions } from '@/components/shared'
import { Wand2, Play, Wallet } from 'lucide-react'
import type { ProfitDistribution } from '@/features/contacts/types/partner'

export interface ProfitDistributionActionsCtx {
    onViewDetail: (dist: ProfitDistribution) => void
    onRetake: (dist: ProfitDistribution) => void
    onExecute: (dist: ProfitDistribution) => void
    onPayDividends: (dist: ProfitDistribution) => void
}

export const profitDistributionActions = createEntityActions<
    ProfitDistribution,
    ProfitDistributionActionsCtx
>((item, ctx) => {
    if (item.status === 'CANCELLED') {
        return <DataCell.Action action="detail" onClick={() => ctx.onViewDetail(item)} />
    }
    return (
        <>
            <DataCell.Action action="detail" onClick={() => ctx.onViewDetail(item)} />
            {item.status === 'DRAFT' && (
                <DataCell.Action icon={Wand2} title="Retomar Proceso" className="text-success" onClick={() => ctx.onRetake(item)} />
            )}
            {item.status === 'APPROVED' && (
                <DataCell.Action icon={Play} title="Ejecutar Contablemente" className="text-primary" onClick={() => ctx.onExecute(item)} />
            )}
            {item.status === 'EXECUTED' && (item.lines?.some((l) => l.destination === 'DIVIDEND')) && (
                <DataCell.Action icon={Wallet} title="Pagar Dividendos" className="text-primary" onClick={() => ctx.onPayDividends(item)} />
            )}
        </>
    )
})
