import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"
import { DomainHubStatus } from "@/components/shared"
import { getDtePrefix } from "@/lib/entity-registry"

export const salesInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
        get: (inv) => {
            const id = inv.display_id ?? inv.number
            return id ? `${getDtePrefix(inv.dte_type)}-${id}` : '-'
        },
    },
    invoiceDate: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    contactDisplayName: {
        key: "partner_name",
        type: "text",
        label: "Cliente",
    },
    domainStatus: {
        key: "status",
        type: "complex",
        label: "Flujo",
        render: (inv) => (
            <DomainHubStatus label="billing.invoice" data={inv} />
        ),
        tableOptions: { width: 180, align: "center", enableSorting: false },
    },
    dteType: {
        key: "dte_type_display",
        type: "chip",
        label: "Tipo DTE",
    },
    totalWithTax: {
        key: "total",
        type: "currency",
        label: "Total",
        intent: "success",
    },
})
