import { createEntityActions } from '@/components/shared'
import type { Contact } from '@/features/contacts/types'

export interface ContactActionsCtx {
    onEdit: (id: number) => void
    onDelete: (contact: Contact) => void
}

export const contactActions = createEntityActions<
    Contact,
    ContactActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    {
        action: "delete",
        onClick: () => ctx.onDelete(item),
        visible: !item.is_default_customer && !item.is_default_vendor,
    },
])
