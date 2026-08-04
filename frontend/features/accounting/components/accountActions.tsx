import { createEntityActions } from '@/components/shared'
import type { Account } from '@/features/accounting/types'

export interface AccountActionsCtx {
    onViewLedger: (account: Account) => void
    onEdit: (account: Account) => void
    onDelete: (id: number) => void
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
        { action: "delete", onClick: () => ctx.onDelete(item.id) },
    ]
)
