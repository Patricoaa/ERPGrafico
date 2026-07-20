import { createEntityFields } from "@/components/shared"
import { DomainHubStatus } from "@/components/shared"
import type { SaleOrder } from "./types"

export const salesOrderFields = createEntityFields<SaleOrder>()({
    displayId: {
        key: "number",
        type: "code",
        label: "Folio",
        get: (o) => o.display_id ?? o.number,
    },
    contactDisplayName: {
        key: "customer_name",
        type: "text",
        label: "Cliente",
    },
    orderDate: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    /**
     * domainStatus — Declarative DomainHubStatus field.
     * type: 'complex' ensures:
     *   - Card view: auto-placed in header with highest priority (complex > primary-value > flow > tag)
     *   - Table view: rendered as a column via toColumns() — no manual column needed in the view
     */
    domainStatus: {
        key: "status",
        type: "complex",
        label: "Estado",
        render: (order) => (
            <DomainHubStatus
                label="sales.saleorder"
                data={order as unknown as Record<string, unknown>}
            />
        ),
        tableOptions: {
            width: 180,
            align: "center",
            enableSorting: false,
        },
    },
    channel: {
        key: "channel_display",
        type: "chip",
        label: "Canal",
    },
})
