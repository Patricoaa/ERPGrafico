import { DataCell, createEntityActions } from '@/components/shared'
import { Eye } from 'lucide-react'
import type { Bank } from '@/features/treasury/types'

export interface BankActionsCtx {
    onView: (id: number) => void
    onEdit: (bank: Bank) => void
    onArchive: (id: number) => void
    onRestore: (id: number) => void
}

export const bankActions = createEntityActions<
    Bank,
    BankActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action icon={Eye} title="Ver detalles" onClick={() => ctx.onView(item.id)} />
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
        {item.is_active ? (
            <DataCell.Action action="archive" onClick={() => ctx.onArchive(item.id)} />
        ) : (
            <DataCell.Action action="restore" onClick={() => ctx.onRestore(item.id)} />
        )}
    </>
))
