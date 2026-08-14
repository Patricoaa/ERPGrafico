import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"
import { DomainHubStatus } from "@/components/shared"
import { getDtePrefix } from "@/lib/entity-registry"

export const purchaseInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
        get: (inv) => {
            const id = inv.display_id ?? inv.number
            return id ? `${getDtePrefix(inv.dte_type)}-${id}` : '-'
        },
    },
    issueDate: {
        key: "date",
        type: "date",
        label: "Fecha Emisión",
    },
    contactDisplayName: {
        key: "partner_name",
        type: "secondary",
        label: "Proveedor",
    },
    dteType: {
        key: "dte_type_display",
        type: "secondary",
        label: "Tipo DTE",
    },
    domainStatus: {
        key: "status",
        type: "computed",
        fieldRole: "complex",
        label: "Flujo",
        render: (inv) => (
            <DomainHubStatus label="billing.invoice" data={inv} />
        ),
        tableOptions: { width: 180, align: "center", enableSorting: false },
    },
    totalWithTax: {
        key: "total",
        type: "currency",
        label: "Total",
        intent: "success",
    },
}, {
    title: { field: 'partner_name', template: '{partner_name|reference}' },
})
