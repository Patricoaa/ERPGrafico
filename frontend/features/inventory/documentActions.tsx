import { createEntityActions } from '@/components/shared'
import type { InventoryDocument } from './types'

export interface InventoryDocumentActionsCtx {
    onViewDetail: (id: number) => void
    onPrint: (doc: InventoryDocument) => void
    onAnnul: (doc: InventoryDocument) => void
}

export const documentActions = createEntityActions<
    InventoryDocument,
    InventoryDocumentActionsCtx
>((item, ctx) => [
    { action: "detail", onClick: () => ctx.onViewDetail(item.id) },
    { action: "print", onClick: () => ctx.onPrint(item) },
    { action: "annul", onClick: () => ctx.onAnnul(item), visible: item.status === 'CONFIRMED' },
])
