import { DataCell, createEntityActions } from '@/components/shared'
import type { Product } from '@/features/inventory/types'

export interface ProductActionsCtx {
    onEdit: (id: number) => void
    onArchive: (product: Product) => void
}

export const productActions = createEntityActions<
    Product,
    ProductActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
        <DataCell.Action
            action={item.is_active ? "archive" : "restore"}
            onClick={() => ctx.onArchive(item)}
        />
    </>
))
