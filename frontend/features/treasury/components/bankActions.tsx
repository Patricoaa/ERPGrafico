import { createEntityActions } from '@/components/shared'
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
>((item, ctx) => [
    { action: "detail", label: "Ver detalles", onClick: () => ctx.onView(item.id) },
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: "archive", onClick: () => ctx.onArchive(item.id), visible: item.is_active },
    { action: "restore", onClick: () => ctx.onRestore(item.id), visible: !item.is_active },
])
