import { DataCell, createEntityActions } from '@/components/shared'
import { Wallet, Eye } from 'lucide-react'
import type { CreditCardStatement } from './types'

export interface StatementActionsCtx {
    onPay: (stmt: CreditCardStatement) => void
    onViewDetail: (id: number) => void
}

export const statementActions = createEntityActions<
    CreditCardStatement,
    StatementActionsCtx
>((item, ctx) => (
    <>
        {item.status !== 'PAID' && item.status !== 'CANCELED' && (
            <DataCell.Action icon={Wallet} title="Pagar" onClick={() => ctx.onPay(item)} />
        )}
        <DataCell.Action icon={Eye} title="Ver detalle" onClick={() => ctx.onViewDetail(item.id)} />
    </>
))
