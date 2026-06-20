import { DataCell, createEntityActions } from '@/components/shared'
import { Eye, ClipboardList, Send } from 'lucide-react'
import type { BankLoan } from './types'

export interface LoanActionsCtx {
    onViewDetail: (id: number) => void
    onAmortization: (id: number) => void
    onDisburse: (loan: BankLoan) => void
}

export const loanActions = createEntityActions<
    BankLoan,
    LoanActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action icon={Eye} title="Ver detalle" onClick={() => ctx.onViewDetail(item.id)} />
        {item.status !== 'DRAFT' && (
            <DataCell.Action icon={ClipboardList} title="Tabla de amortización" onClick={() => ctx.onAmortization(item.id)} />
        )}
        {item.status === 'DRAFT' && (
            <DataCell.Action icon={Send} title="Desembolsar" onClick={() => ctx.onDisburse(item)} />
        )}
    </>
))
