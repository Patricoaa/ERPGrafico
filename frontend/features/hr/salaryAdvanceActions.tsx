import { createEntityActions } from '@/components/shared'
import type { SalaryAdvance } from '@/types/hr'

export interface SalaryAdvanceActionsCtx {
    onEdit: (advance: SalaryAdvance) => void
    onDelete: (advance: SalaryAdvance) => void
    onAnnul: (advance: SalaryAdvance) => void
}

export const salaryAdvanceActions = createEntityActions<
    SalaryAdvance,
    SalaryAdvanceActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item), visible: item.status === "DRAFT" },
    { action: "delete", onClick: () => ctx.onDelete(item), visible: item.status === "DRAFT" },
    { action: "annul", onClick: () => ctx.onAnnul(item), visible: item.status === "PAID" && item.payroll === null },
])
