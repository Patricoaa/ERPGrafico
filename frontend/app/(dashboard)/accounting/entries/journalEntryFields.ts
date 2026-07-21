import { createEntityFields } from "@/components/shared"
import { translateStatus } from "@/lib/utils"
import type { JournalEntry } from "@/features/accounting"

export const journalEntryFields = createEntityFields<JournalEntry>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
    origin: {
        key: "is_manual",
        type: "chip",
        label: "Origen",
        get: (e) => {
            if (e.is_manual) return "Manual"
            if (e.reversal_of) return "Reversión"
            return "Automático"
        },
        intent: (e) => {
            if (e.is_manual) return "neutral"
            if (e.reversal_of) return "warning"
            return "info"
        },
        tableOptions: { enableSorting: false },
    },
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    description: {
        key: "description",
        type: "text",
        label: "Descripción",
        cellProps: { className: "truncate max-w-[300px]" },
    },
    totalDebit: {
        key: "total_debit",
        type: "currency",
        label: "Total Débito",
        get: (e) => e.items?.reduce((sum, item) => sum + (Number(item.debit) || 0), 0) || 0,
    },
}, {
    title: { field: 'display_id' },
    subtitle: {
        renderer: (e) => {
            const origin = e.is_manual ? "Manual" : e.reversal_of ? "Reversión" : "Automático"
            const originIntent = e.is_manual ? "neutral" : e.reversal_of ? "warning" : "info"
            return [
                { kind: 'date', value: e.date },
                { kind: 'separator' },
                { kind: 'chip', content: origin, intent: originIntent },
                { kind: 'separator' },
                { kind: 'status', label: translateStatus(e.status), status: e.status },
            ]
        },
    },
})
