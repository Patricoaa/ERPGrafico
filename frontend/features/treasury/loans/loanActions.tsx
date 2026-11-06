import { createEntityActions } from '@/components/shared'
import { Send } from 'lucide-react'
import type { BankLoan } from './types'

export interface LoanActionsCtx {
    onViewDetail: (id: number) => void
    onDisburse: (loan: BankLoan) => void
    onPayNext: (id: number) => void
    onPrepay: (id: number) => void
}

export const loanActions = createEntityActions<
    BankLoan,
    LoanActionsCtx
>((item, ctx) => [
    { action: "detail", label: "Ver detalle", onClick: () => ctx.onViewDetail(item.id) },
    { action: "pay", label: "Siguiente pago", onClick: () => ctx.onPayNext(item.id), visible: item.status === 'ACTIVE' },
    { action: "prepay", onClick: () => ctx.onPrepay(item.id), visible: item.status === 'ACTIVE' },
    { action: "disburse", icon: Send, onClick: () => ctx.onDisburse(item), visible: item.status === 'DRAFT' },
])
