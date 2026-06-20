import { DataCell, createEntityActions } from '@/components/shared'
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
        return (
            <DataCell.Action
                action="lock"
                title="Gestionada por sistema"
                onClick={() => ctx.onEdit(item)}
                className="text-muted-foreground cursor-default opacity-50"
            />
        )
    }
    return (
        <>
            <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
            <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id)} />
        </>
    )
})
