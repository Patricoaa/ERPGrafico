import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"

export const salesInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
        surfaces: ["card", "kanban"],
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
        surfaces: ["card", "kanban"],
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
        surfaces: ["card", "kanban"],
    },
})
