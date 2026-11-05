import { createEntityActions, type StructuredAction } from '@/components/shared'
import { Ban, RotateCcw } from 'lucide-react'
import type { BankStatementLine } from '@/features/finance/bank-reconciliation/types'

export interface StatementLineActionsCtx {
    onExclude: (lineId: number) => void
    onRestore: (lineId: number) => void
}

/** Acciones de una línea de cartola. Se usan tanto en `.auto()` como en la celda de la mesa (`RowActionsCell`). */
export function statementLineActionItems(item: BankStatementLine, ctx: StatementLineActionsCtx): StructuredAction[] {
    return [
        {
            action: "reverse",
            icon: RotateCcw,
            label: "Restaurar",
            iconColor: "text-success",
            onClick: (e) => { e.stopPropagation(); ctx.onRestore(item.id) },
            visible: item.reconciliation_status === 'EXCLUDED',
        },
        {
            action: "annul",
            icon: Ban,
            label: "Excluir",
            iconColor: "text-muted-foreground",
            onClick: (e) => { e.stopPropagation(); ctx.onExclude(item.id) },
            visible: item.reconciliation_status !== 'EXCLUDED',
        },
    ]
}

export const statementLineActions = createEntityActions<BankStatementLine, StatementLineActionsCtx>(statementLineActionItems)
