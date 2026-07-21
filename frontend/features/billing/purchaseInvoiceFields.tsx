import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"
import { DomainHubStatus } from "@/components/shared"
import { getDtePrefix } from "@/lib/entity-registry"

export const purchaseInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        order: 10,
        key: "display_id",
        type: "code",
        label: "Folio",
        get: (inv) => {
            const id = inv.display_id ?? inv.number
            return id ? `${getDtePrefix(inv.dte_type)}-${id}` : '-'
        },
    },
    issueDate: {
        order: 20,
        key: "date",
        type: "date",
        label: "Fecha Emisión",
    },
    contactDisplayName: {
        order: 30,
        key: "partner_name",
        type: "text",
        label: "Proveedor",
    },
    dteType: {
        order: 40,
        key: "dte_type_display",
        type: "chip",
        label: "Tipo DTE",
    },
    domainStatus: {
        order: 45,
        key: "status",
        type: "complex",
        label: "Flujo",
        render: (inv) => (
            <DomainHubStatus label="billing.invoice" data={inv} />
        ),
        tableOptions: { width: 180, align: "center", enableSorting: false },
    },
    totalWithTax: {
        order: 50,
        key: "total",
        type: "currency",
        label: "Total",
        cellProps: { intent: "success" },
    },
}, {
    title: { field: 'partner_name', template: '{partner_name|reference}' },
})
