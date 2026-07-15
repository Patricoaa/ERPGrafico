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
    date: {
        key: "due_date",
        type: "date",
        label: "Fecha",
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
        tableOptions: { align: "right" },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
})
