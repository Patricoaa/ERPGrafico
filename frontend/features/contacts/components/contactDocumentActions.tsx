import { DataCell, createEntityActions } from '@/components/shared'

export interface ContactDocumentActionsCtx {
    onHub: (item: Record<string, unknown>) => void
}

export const contactDocumentActions = createEntityActions<Record<string, unknown>, ContactDocumentActionsCtx>((item, ctx) => (
    <DataCell.Action
        action="hub"
        onClick={() => ctx.onHub(item)}
    />
))
