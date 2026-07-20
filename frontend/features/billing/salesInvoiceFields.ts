import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"

export const salesInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    invoiceDate: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    dueDate: {
        key: "due_date",
        type: "date",
        label: "Vencimiento",
    },
    contactDisplayName: {
        key: "partner_name",
        type: "text",
        label: "Cliente",
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
    dteType: {
        key: "dte_type_display",
        type: "chip",
        label: "Tipo DTE",
    },
})
