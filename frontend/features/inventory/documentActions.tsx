import { DataCell, createEntityActions } from '@/components/shared'
import type { InventoryDocument } from './types'

export interface InventoryDocumentActionsCtx {
    onViewDetail: (id: number) => void
    onPrint: (doc: InventoryDocument) => void
    onAnnul: (doc: InventoryDocument) => void
}

export const documentActions = createEntityActions<
    InventoryDocument,
    InventoryDocumentActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="detail" onClick={() => ctx.onViewDetail(item.id)} />
        <DataCell.Action action="print" onClick={() => ctx.onPrint(item)} />
        {item.status === 'CONFIRMED' && (
            <DataCell.Action action="annul" onClick={() => ctx.onAnnul(item)} />
        )}
    </>
))
