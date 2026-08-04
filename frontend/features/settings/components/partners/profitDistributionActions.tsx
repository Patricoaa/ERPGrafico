import { createEntityActions } from '@/components/shared'
import { Wand2, Play, Wallet } from 'lucide-react'
import type { ProfitDistribution } from '@/features/contacts'

export interface ProfitDistributionActionsCtx {
    onViewDetail: (dist: ProfitDistribution) => void
    onRetake: (dist: ProfitDistribution) => void
    onExecute: (dist: ProfitDistribution) => void
    onPayDividends: (dist: ProfitDistribution) => void
}

export const profitDistributionActions = createEntityActions<
    ProfitDistribution,
    ProfitDistributionActionsCtx
>((item, ctx) => [
    { action: "detail", onClick: () => ctx.onViewDetail(item) },
    {
        action: "detail",
        icon: Wand2,
        label: "Retomar Proceso",
        className: "text-success",
        onClick: () => ctx.onRetake(item),
        visible: item.status === 'DRAFT',
    },
    {
        action: "post",
        icon: Play,
        label: "Ejecutar Contablemente",
        className: "text-primary",
        onClick: () => ctx.onExecute(item),
        visible: item.status === 'APPROVED',
    },
    {
        action: "pay",
        icon: Wallet,
        label: "Pagar Dividendos",
        className: "text-primary",
        onClick: () => ctx.onPayDividends(item),
        visible: item.status === 'EXECUTED' && (item.lines?.some((l) => l.destination === 'DIVIDEND')),
    },
])
