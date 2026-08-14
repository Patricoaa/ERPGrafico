import { createEntityFields, DataCell, DomainHubStatus } from "@/components/shared"
import type { SaleOrder } from "./types"

export const salesOrderFields = createEntityFields<SaleOrder>()({
    displayId: {
        key: "number",
        type: "code",
        label: "Folio",
        get: (o) => o.display_id ?? o.number,
    },
    contactDisplayName: {
        key: "customer",
        type: "contact",
        label: "Cliente",
        get: (o) => o.customer,
        getDisplay: (o) => o.customer_name,
    },
    orderDate: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    /**
     * domainStatus — Declarative DomainHubStatus field.
     * `fieldRole: 'complex'` ensures:
     *   - Card view: auto-placed in header with highest priority (complex > primary-value > flow > tag)
     *   - Table view: rendered as a column via toColumns() — no manual column needed in the view
     */
    domainStatus: {
        key: "status",
        type: "computed",
        fieldRole: "complex",
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
        key: "channel",
        type: "chip-category",
        domain: "channel",
        label: "Canal",
    },
    workflow: {
        key: "workflow",
        type: "computed",
        fieldRole: "complex",
        label: "Resumen",
        surfaces: ["table"],
        render: (order) => {
            const o = order as unknown as SaleOrder & { delivery_date?: string };
            return (
                <DataCell.WorkflowSummary
                    lines={o.lines}
                    total={parseFloat(String(o.total || 0))}
                    pending={parseFloat(String(o.pending_amount || 0))}
                    deliveryDate={o.delivery_date}
                />
            )
        },
        tableOptions: {
            width: 180,
            align: "right",
            enableSorting: false,
        },
    },
})
