import { DataCell, createEntityActions } from '@/components/shared'
import { Eye } from 'lucide-react'
import type { BankStatement } from '../types'

export interface StatementActionsCtx {
    onView: (id: number) => void
}

export const statementActions = createEntityActions<
    BankStatement,
    StatementActionsCtx
>((item, ctx) => (
    <DataCell.Action icon={Eye} title="Ver" onClick={() => ctx.onView(item.id)} />
))
