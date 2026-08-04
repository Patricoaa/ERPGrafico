import { createEntityActions } from '@/components/shared'
import type { Budget } from './hooks/useBudgets'

export interface BudgetActionsCtx {
    onEdit: (id: number) => void
    onViewExecution: (id: number) => void
}

export const budgetActions = createEntityActions<
    Budget,
    BudgetActionsCtx
>((item, ctx) => [
    { action: "edit", label: "Editar Montos", onClick: () => ctx.onEdit(item.id) },
    { action: "report", label: "Ver Ejecución", onClick: () => ctx.onViewExecution(item.id) },
])
