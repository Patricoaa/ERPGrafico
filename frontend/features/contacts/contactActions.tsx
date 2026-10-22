import { createEntityActions } from '@/components/shared'
import type { Contact } from '@/features/contacts/types'

export interface ContactActionsCtx {
    onEdit: (id: number) => void
    onArchive: (contact: Contact) => void
}

export const contactActions = createEntityActions<
    Contact,
    ContactActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    {
        action: item.is_active ? "archive" : "restore",
        onClick: () => ctx.onArchive(item),
        visible: !item.is_default_customer && !item.is_default_vendor,
    },
])
