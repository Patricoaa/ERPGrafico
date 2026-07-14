import { createEntityActions } from '@/components/shared'
import { Wallet } from 'lucide-react'
import type { CreditCardStatement } from './types'

export interface StatementActionsCtx {
    onPay: (stmt: CreditCardStatement) => void
    onViewDetail: (id: number) => void
}

export const statementActions = createEntityActions<
    CreditCardStatement,
    StatementActionsCtx
>((item, ctx) => [
    { action: "pay", icon: Wallet, onClick: () => ctx.onPay(item), visible: item.status !== 'PAID' && item.status !== 'CANCELED' },
    { action: "detail", label: "Ver detalle", onClick: () => ctx.onViewDetail(item.id) },
])
