import { createEntityActions } from '@/components/shared'
import type { Employee } from '@/types/hr'

export interface EmployeeActionsCtx {
    onEdit: (id: number) => void
}

export const employeeActions = createEntityActions<
    Employee,
    EmployeeActionsCtx
>((item, ctx) => [
    { action: "edit", label: "Editar Empleado", onClick: () => ctx.onEdit(item.id) },
])
