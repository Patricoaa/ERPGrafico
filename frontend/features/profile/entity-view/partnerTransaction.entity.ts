import { defineEntity } from "@/components/entity-view"
import { docRef, type DocRefValue } from "@/features/documents"
import type { PartnerTransaction } from "@/features/contacts"

export type PartnerTransactionRow = PartnerTransaction & { balance_after: number }

const fixed = { sortable: false } as const

const resolveDocRef = (tx: PartnerTransactionRow): DocRefValue | null => {
    if (tx.stock_move) return { label: 'inventory.stockmove', id: tx.stock_move, display: tx.journal_entry_display, url: null }
    if (tx.treasury_movement) return { label: 'treasury.treasurymovement', id: tx.treasury_movement, display: tx.journal_entry_display, url: null }
    if (tx.distribution_resolution) return { label: 'contacts.profitdistributionresolution', id: tx.distribution_resolution, display: tx.journal_entry_display, url: null }
    if (tx.journal_entry_id) return { label: 'accounting.journalentry', id: tx.journal_entry_id, display: tx.journal_entry_display, url: null }
    return null
}

export const partnerTransactionEntity = defineEntity<PartnerTransactionRow>()((f) => ({
    title: "Historial de Capital",
    fields: {
        date: f.date((tx) => tx.date, { ...fixed, label: "Fecha" }),
        transactionType: f.text((tx) => tx.transaction_type_display || tx.transaction_type, { ...fixed, label: "Operación" }),
        amount: f.money((tx) => Number(tx.amount), { ...fixed, label: "Monto" }),
        balanceAfter: f.money((tx) => tx.balance_after, { ...fixed, label: "Saldo" }),
        document: docRef(f, resolveDocRef, { ...fixed, label: "Asiento" }),
    },
}))

export const partnerTransactionViews = partnerTransactionEntity.views({
    table: { columns: ["date", "transactionType", "amount", "balanceAfter", "document"] },
})
