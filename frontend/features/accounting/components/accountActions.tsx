import { Book, Pencil, Trash2 } from "lucide-react"
import { DataCell, createEntityActions } from '@/components/shared'
import type { Account } from '@/features/accounting/types'

export interface AccountActionsCtx {
    onViewLedger: (account: Account) => void
    onEdit: (account: Account) => void
    onDelete: (id: number) => void
}

export const accountActions = createEntityActions<Account, AccountActionsCtx>(
    (item, ctx) => (
        <>
            {item.is_selectable && (
                <DataCell.Action
                    icon={Book}
                    title="Ver Libro Mayor"
                    color="text-primary"
                    onClick={() => ctx.onViewLedger(item)}
                />
            )}
            <DataCell.Action icon={Pencil} title="Editar" onClick={() => ctx.onEdit(item)} />
            <DataCell.Action icon={Trash2} title="Eliminar" onClick={() => ctx.onDelete(item.id)} />
        </>
    )
)
