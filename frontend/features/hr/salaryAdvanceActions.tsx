import { createEntityActions } from '@/components/shared'
import type { SalaryAdvance } from '@/types/hr'

export interface SalaryAdvanceActionsCtx {
    onEdit: (advance: SalaryAdvance) => void
    onDelete: (id: number) => void
}

export const salaryAdvanceActions = createEntityActions<
    SalaryAdvance,
    SalaryAdvanceActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item), visible: !item.is_discounted },
    {
        action: "delete",
        onClick: () => {
            if (confirm("¿Eliminar anticipo? Esta acción no se puede deshacer.")) {
                ctx.onDelete(item.id)
            }
        },
    },
])
