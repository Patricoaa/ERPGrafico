import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"
import { DomainHubStatus } from "@/components/shared"

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
