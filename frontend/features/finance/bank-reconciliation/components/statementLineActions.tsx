import { createEntityActions } from '@/components/shared'
import { Ban, RotateCcw } from 'lucide-react'
import type { BankStatementLine } from '@/features/finance/bank-reconciliation/types'

export interface StatementLineActionsCtx {
    onExclude: (lineId: number) => void
    onRestore: (lineId: number) => void
}

export const statementLineActions = createEntityActions<BankStatementLine, StatementLineActionsCtx>((item, ctx) => [
    {
        action: "reverse",
        icon: RotateCcw,
        label: "Restaurar",
        className: "text-success hover:text-success/80",
        onClick: (e) => { e.stopPropagation(); ctx.onRestore(item.id) },
        visible: item.reconciliation_status === 'EXCLUDED',
    },
    {
        action: "annul",
        icon: Ban,
        label: "Excluir",
        className: "text-muted-foreground hover:text-destructive",
        onClick: (e) => { e.stopPropagation(); ctx.onExclude(item.id) },
        visible: item.reconciliation_status !== 'EXCLUDED',
    },
])
