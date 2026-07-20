import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"

export const purchaseInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
        surfaces: ["card", "kanban"],
    },
    issueDate: {
        key: "date",
        type: "date",
        label: "Fecha Emisión",
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
        label: "Proveedor",
    },
    totalWithTax: {
        key: "total",
        type: "currency",
        label: "Total",
        cellProps: { intent: "success" },
    },
    totalWithTaxLocal: {
        key: "total",
        type: "currency",
        label: "Total (Local)",
        surfaces: ["card", "kanban"],
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        surfaces: ["card", "kanban"],
    },
}, {
    title: { field: 'partner_name', template: '{partner_name|reference}' },
})
