import { createEntityFields } from "@/components/shared"
import type { Check } from "./types"

export const checkFields = createEntityFields<Check>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    checkNumber: {
        key: "check_number",
        type: "text",
        label: "# Cheque",
    },
    dueDate: {
        key: "due_date",
        type: "date",
        label: "Vencimiento",
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
        get: (c) => parseFloat(c.amount) || 0,
        cellProps: { weight: "bold" },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
}, {
    title: { field: 'check_number' },
})
