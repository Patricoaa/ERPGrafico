import { createEntityActions } from '@/components/shared'
import { ClipboardList, Send } from 'lucide-react'
import type { BankLoan } from './types'

export interface LoanActionsCtx {
    onViewDetail: (id: number) => void
    onAmortization: (id: number) => void
    onDisburse: (loan: BankLoan) => void
}

export const loanActions = createEntityActions<
    BankLoan,
    LoanActionsCtx
>((item, ctx) => [
    { action: "detail", label: "Ver detalle", onClick: () => ctx.onViewDetail(item.id) },
    { action: "report", icon: ClipboardList, label: "Tabla de amortización", onClick: () => ctx.onAmortization(item.id), visible: item.status !== 'DRAFT' },
    { action: "disburse", icon: Send, onClick: () => ctx.onDisburse(item), visible: item.status === 'DRAFT' },
])
