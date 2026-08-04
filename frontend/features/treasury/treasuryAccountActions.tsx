import { createEntityActions } from '@/components/shared'
import type { TreasuryAccount } from '@/features/treasury'

export interface TreasuryAccountActionsCtx {
    onEdit: (item: TreasuryAccount) => void
    onDelete: (id: number) => void
}

export const treasuryAccountActions = createEntityActions<
    TreasuryAccount,
    TreasuryAccountActionsCtx
>((item, ctx) => {
    if (item.is_system_managed) {
        return [
            {
                action: "lock",
                label: "Gestionada por sistema",
                className: "text-muted-foreground cursor-default opacity-50",
                onClick: () => ctx.onEdit(item),
            },
        ]
    }
    return [
        { action: "edit", onClick: () => ctx.onEdit(item) },
        { action: "delete", onClick: () => ctx.onDelete(item.id) },
    ]
})
