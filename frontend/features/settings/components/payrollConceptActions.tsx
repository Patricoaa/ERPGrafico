import { createEntityActions } from '@/components/shared'
import type { PayrollConcept } from '@/types/hr'

export interface PayrollConceptActionsCtx {
    onEdit: (concept: PayrollConcept) => void
    onDelete: (id: number) => void
}

export const payrollConceptActions = createEntityActions<
    PayrollConcept,
    PayrollConceptActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: "delete", onClick: () => ctx.onDelete(item.id), visible: !item.is_system },
])
