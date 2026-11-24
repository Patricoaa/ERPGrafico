import { createEntityActions } from '@/components/shared'
import { CheckCircle } from 'lucide-react'
import type { JournalEntry } from '@/features/accounting'

export interface JournalEntryActionsCtx {
    onEdit: (id: number) => void
    onView: (id: number) => void
    onPublish: (id: number) => void
    onDelete: (id: number) => void
    onReverse: (id: number) => void
}

export const journalEntryActions = createEntityActions<JournalEntry, JournalEntryActionsCtx>((entry, ctx) => {
    const isDraft = entry.status === 'DRAFT'
    const isPostedOrClosed = entry.status === 'POSTED' || entry.status === 'CLOSED'

    return [
        { action: "edit", onClick: () => ctx.onEdit(entry.id), visible: isDraft },
        { action: "view", onClick: () => ctx.onView(entry.id), visible: !isDraft },
        { action: "post", icon: CheckCircle, label: "Publicar", onClick: () => ctx.onPublish(entry.id), visible: isDraft },
        { action: "delete", onClick: () => ctx.onDelete(entry.id), visible: isDraft },
        { action: "reverse", label: "Reversar", onClick: () => ctx.onReverse(entry.id), visible: isPostedOrClosed && entry.is_manual },
    ]
})
