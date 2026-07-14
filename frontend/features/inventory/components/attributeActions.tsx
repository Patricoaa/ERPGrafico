import { createEntityActions } from '@/components/shared'

export interface AttributeActionsCtx {
    onViewEdit: (attr: unknown) => void
    onDelete: (id: number) => void
}

export const attributeActions = createEntityActions<unknown, AttributeActionsCtx>((item, ctx) => [
    {
        action: "detail",
        label: "Ver/Editar Atributo",
        iconColor: "text-primary",
        onClick: () => ctx.onViewEdit(item),
    },
    {
        action: "delete",
        label: "Eliminar Atributo",
        className: "text-destructive",
        onClick: () => {
            const attr = item as { id: number }
            ctx.onDelete(attr.id)
        },
    },
])
