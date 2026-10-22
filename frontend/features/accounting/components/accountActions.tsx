import { createEntityActions } from '@/components/shared'
import type { Account } from '@/features/accounting/types'

export interface AccountActionsCtx {
    onEdit: (account: Account) => void
    onArchive: (account: Account) => void
}

export const accountActions = createEntityActions<Account, AccountActionsCtx>(
    (item, ctx) => [
        { action: "edit", onClick: () => ctx.onEdit(item) },
        { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
    ]
)
