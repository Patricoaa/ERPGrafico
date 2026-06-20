import { DataCell, createEntityActions } from '@/components/shared'
import { Ban, RotateCcw } from 'lucide-react'
import type { BankStatementLine } from '@/features/finance/bank-reconciliation/types'

export interface StatementLineActionsCtx {
    onExclude: (lineId: number) => void
    onRestore: (lineId: number) => void
}

export const statementLineActions = createEntityActions<BankStatementLine, StatementLineActionsCtx>((item, ctx) =>
    item.reconciliation_status === 'EXCLUDED' ? (
        <DataCell.Action
            icon={RotateCcw}
            title="Restaurar"
            className="text-success hover:text-success/80"
            onClick={(e) => { e.stopPropagation(); ctx.onRestore(item.id) }}
        />
    ) : (
        <DataCell.Action
            icon={Ban}
            title="Excluir"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); ctx.onExclude(item.id) }}
        />
    )
)
