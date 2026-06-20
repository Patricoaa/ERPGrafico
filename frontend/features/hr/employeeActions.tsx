import { DataCell, createEntityActions } from '@/components/shared'
import type { Employee } from '@/types/hr'
import { Pencil } from "lucide-react"

export interface EmployeeActionsCtx {
    onEdit: (id: number) => void
}

export const employeeActions = createEntityActions<
    Employee,
    EmployeeActionsCtx
>((item, ctx) => (
    <DataCell.Action
        icon={Pencil}
        title="Editar Empleado"
        onClick={() => ctx.onEdit(item.id)}
    />
))
