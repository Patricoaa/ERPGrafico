import { createEntityActions } from '@/components/shared'
import type { EmployeeMovement } from '@/types/hr'

export interface EmployeeMovementActionsCtx {
    onEdit: (movement: EmployeeMovement) => void
    onDelete: (movement: EmployeeMovement) => void
    onAnnul: (movement: EmployeeMovement) => void
}

export const employeeMovementActions = createEntityActions<
    EmployeeMovement,
    EmployeeMovementActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item), visible: item.status === "DRAFT" },
    { action: "delete", onClick: () => ctx.onDelete(item), visible: item.status === "DRAFT" },
    { action: "annul", onClick: () => ctx.onAnnul(item), visible: item.status === "POSTED" && item.kind !== "PAYMENT" && item.allocations.length === 0 },
])
