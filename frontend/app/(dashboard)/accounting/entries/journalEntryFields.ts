import { createEntityFields } from "@/components/shared"
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
        cardPlacement: "header-right",
    },
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
        cardPlacement: "header-right",
    },
    description: {
        key: "description",
        type: "text",
        label: "Descripción",
        cellProps: { className: "truncate max-w-[300px]" },
        cardPlacement: "center",
    },
    totalDebit: {
        key: "total_debit",
        type: "currency",
        label: "Total Débito",
        get: (e) => e.items?.reduce((sum, item) => sum + (Number(item.debit) || 0), 0) || 0,
        surfaces: ["card"],
        cardPlacement: "header-right",
    },
})
