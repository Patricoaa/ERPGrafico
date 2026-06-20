import { DataCell, createEntityActions } from '@/components/shared'
import { Pencil, FileText } from 'lucide-react'
import type { Budget } from './hooks/useBudgets'

export interface BudgetActionsCtx {
    onEdit: (id: number) => void
    onViewExecution: (id: number) => void
}

export const budgetActions = createEntityActions<
    Budget,
    BudgetActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action icon={Pencil} title="Editar Montos" onClick={() => ctx.onEdit(item.id)} />
        <DataCell.Action icon={FileText} title="Ver Ejecución" onClick={() => ctx.onViewExecution(item.id)} />
    </>
))
