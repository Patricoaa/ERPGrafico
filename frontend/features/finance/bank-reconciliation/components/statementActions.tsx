import { createEntityActions } from '@/components/shared'
import type { BankStatement } from '../types'

export interface StatementActionsCtx {
    onView: (id: number) => void
}

export const statementActions = createEntityActions<
    BankStatement,
    StatementActionsCtx
>((item, ctx) => [
    { action: "detail", label: "Ver", onClick: () => ctx.onView(item.id) },
])
