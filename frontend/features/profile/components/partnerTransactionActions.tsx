import { DataCell, createEntityActions } from '@/components/shared'
import { Eye } from 'lucide-react'
import type { PartnerTransaction } from '@/features/contacts'

export interface PartnerTransactionActionsCtx {
    onViewDocument: (type: string, id: number) => void
}

const resolveDocument = (item: PartnerTransaction): { type: string; id: number } | null => {
    if (item.stock_move) return { type: 'stock_move', id: item.stock_move }
    if (item.treasury_movement) return { type: 'cash_movement', id: item.treasury_movement }
    if (item.distribution_resolution) return { type: 'profit_distribution', id: item.distribution_resolution }
    if (item.journal_entry_id) return { type: 'journal_entry', id: item.journal_entry_id }
    return null
}

export const partnerTransactionActions = createEntityActions<
    PartnerTransaction,
    PartnerTransactionActionsCtx
>((item, ctx) => {
    const doc = resolveDocument(item)
    return doc ? (
        <DataCell.Action icon={Eye} title="Ver Documento" onClick={() => ctx.onViewDocument(doc.type, doc.id)} />
    ) : (
        <span className="text-[10px] text-muted-foreground italic">No vinculado</span>
    )
})
