import { createEntityActions } from '@/components/shared'

export interface BOMManagerActionsCtx {
    onClone: (bom: unknown) => void
    onEdit: (bom: unknown) => void
    onDelete: (bom: unknown) => void
}

export const bomManagerActions = createEntityActions<unknown, BOMManagerActionsCtx>((item, ctx) => [
    { action: "duplicate", label: "Clonar Receta", className: "text-success hover:text-success", onClick: () => ctx.onClone(item) },
    { action: "edit", label: "Editar", className: "text-primary hover:text-primary", onClick: () => ctx.onEdit(item) },
    { action: "delete", label: "Eliminar", className: "text-destructive hover:text-destructive", onClick: () => ctx.onDelete(item) },
])
