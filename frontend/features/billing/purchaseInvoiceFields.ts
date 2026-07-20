import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"

export const purchaseInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        order: 10,
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    issueDate: {
        order: 20,
        key: "date",
        type: "date",
        label: "Fecha Emisión",
    },
    dueDate: {
        order: 30,
        key: "due_date",
        type: "date",
        label: "Vencimiento",
    },
    contactDisplayName: {
        order: 40,
        key: "partner_name",
        type: "text",
        label: "Proveedor",
    },
    totalWithTax: {
        order: 50,
        key: "total",
        type: "currency",
        label: "Total",
        cellProps: { intent: "success" },
    },
    totalWithTaxLocal: {
        order: 60,
        key: "total",
        type: "currency",
        label: "Total (Local)",
    },
    status: {
        order: 70,
        key: "status",
        type: "status",
        label: "Estado",
    },
}, {
    title: { field: 'partner_name', template: '{partner_name|reference}' },
})
