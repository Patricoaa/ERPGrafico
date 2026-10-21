import { createEntityActions } from '@/components/shared'
import type { Attribute } from '@/features/inventory/hooks/useAttributes'

export interface AttributeActionsCtx {
    onEdit: (id: number) => void
    onArchive: (item: Attribute) => void
}

export const attributeActions = createEntityActions<Attribute, AttributeActionsCtx>((item, ctx) => [
    {
        action: "edit",
        onClick: () => ctx.onEdit(item.id),
    },
    {
        action: item.is_active ? "archive" : "restore",
        onClick: () => ctx.onArchive(item),
    },
])
