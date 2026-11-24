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
    { action: "annul", onClick: () => ctx.onAnnul(item), visible: item.status === "POSTED" && (item.kind === "PAYMENT" || item.allocations.length === 0) },
])

export interface EmployeeMovementHistoryActionsCtx {
    onViewSchedule: (movement: EmployeeMovement) => void
}

/** Acciones del historial en la ficha del empleado: ver el plan de cuotas de un préstamo. */
export const employeeMovementHistoryActions = createEntityActions<
    EmployeeMovement,
    EmployeeMovementHistoryActionsCtx
>((item, ctx) => [
    { action: "detail", label: "Ver cuotas", onClick: () => ctx.onViewSchedule(item), visible: item.kind === "LOAN" && item.installments.length > 0 },
])
