import { createEntityActions } from '@/components/shared'
import type { Account } from '@/features/accounting/types'

export interface AccountActionsCtx {
    onViewLedger: (account: Account) => void
    onEdit: (account: Account) => void
    onArchive: (account: Account) => void
}

export const accountActions = createEntityActions<Account, AccountActionsCtx>(
    (item, ctx) => [
        {
            action: "detail",
            label: "Ver Libro Mayor",
            iconColor: "text-primary",
            onClick: () => ctx.onViewLedger(item),
            visible: item.is_selectable,
        },
        { action: "edit", onClick: () => ctx.onEdit(item) },
        { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
    ]
)
