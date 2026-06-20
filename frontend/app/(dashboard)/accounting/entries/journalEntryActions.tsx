import { DataCell, createEntityActions } from '@/components/shared'
import { CheckCircle, RotateCcw } from 'lucide-react'
import type { JournalEntry } from '@/features/accounting'

export interface JournalEntryActionsCtx {
    onEdit: (id: number) => void
    onDetail: (id: number) => void
    onPublish: (id: number) => void
    onDelete: (id: number) => void
    onReverse: (id: number) => void
}

export const journalEntryActions = createEntityActions<JournalEntry, JournalEntryActionsCtx>((entry, ctx) => (
    <>
        {entry.status === 'DRAFT' ? (
            <DataCell.Action action="edit" onClick={() => ctx.onEdit(entry.id)} />
        ) : (
            <DataCell.Action action="detail" onClick={() => ctx.onDetail(entry.id)} />
        )}
        {entry.status === 'DRAFT' && (
            <DataCell.Action
                icon={CheckCircle}
                title="Publicar"
                onClick={() => ctx.onPublish(entry.id)}
            />
        )}
        {entry.status === 'DRAFT' && (
            <DataCell.Action
                action="delete"
                onClick={() => ctx.onDelete(entry.id)}
            />
        )}
        {(entry.status === 'POSTED' || entry.status === 'CLOSED') && entry.is_manual && (
            <DataCell.Action
                icon={RotateCcw}
                title="Reversar"
                onClick={() => ctx.onReverse(entry.id)}
            />
        )}
    </>
))
