import { createEntityActions } from '@/components/shared'
import type { Attribute } from '@/features/inventory/hooks/useAttributes'

export interface AttributeActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const attributeActions = createEntityActions<Attribute, AttributeActionsCtx>((item, ctx) => [
    {
        action: "edit",
        onClick: () => ctx.onEdit(item.id),
    },
    {
        action: "delete",
        className: "text-destructive",
        onClick: () => ctx.onDelete(item.id),
    },
])
