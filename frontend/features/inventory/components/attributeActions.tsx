import { createEntityActions } from '@/components/shared'

export interface AttributeActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const attributeActions = createEntityActions<unknown, AttributeActionsCtx>((item, ctx) => [
    {
        action: "edit",
        onClick: () => {
            const attr = item as { id: number }
            ctx.onEdit(attr.id)
        },
    },
    {
        action: "delete",
        className: "text-destructive",
        onClick: () => {
            const attr = item as { id: number }
            ctx.onDelete(attr.id)
        },
    },
])
