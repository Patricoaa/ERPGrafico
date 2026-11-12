import { createEntityActions } from '@/components/shared'
import type { PartnerTransaction } from '@/features/contacts'

export interface PartnerTransactionActionsCtx {
    /** Abre el documento origen como pestaña de trabajo (`openEntity`). */
    onViewDocument: (label: string, id: number) => void
}

/** Documento de respaldo de un movimiento de socio, por prioridad: bienes, tesorería, resolución, asiento. */
export function resolvePartnerTransactionDocument(item: PartnerTransaction): { label: string; id: number } | null {
    if (item.stock_move) return { label: 'inventory.stockmove', id: item.stock_move }
    if (item.treasury_movement) return { label: 'treasury.treasurymovement', id: item.treasury_movement }
    if (item.distribution_resolution) return { label: 'contacts.profitdistributionresolution', id: item.distribution_resolution }
    if (item.journal_entry_id) return { label: 'accounting.journalentry', id: item.journal_entry_id }
    return null
}

export const partnerTransactionActions = createEntityActions<
    PartnerTransaction,
    PartnerTransactionActionsCtx
>((item, ctx) => {
    const doc = resolvePartnerTransactionDocument(item)
    return [
        {
            action: "detail",
            label: "Ver documento",
            onClick: () => doc && ctx.onViewDocument(doc.label, doc.id),
            visible: !!doc,
        },
    ]
})
