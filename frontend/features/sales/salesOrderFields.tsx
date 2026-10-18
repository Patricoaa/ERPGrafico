import { createEntityFields, DataCell, DomainHubStatus, StatusBadge } from "@/components/shared"
import type { SaleOrder } from "./types"
import { orderStageSummary } from "./utils/orderStage"

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
     * domainStatus — Declarative DomainHubStatus field (card/kanban surface).
     * Table queues use the readable `stageSummary` column instead (DTL-01).
     */
    domainStatus: {
        key: "status",
        type: "computed",
        fieldRole: "complex",
        label: "Estado",
        surfaces: ["card", "kanban"],
        render: (order) => (
            <DomainHubStatus
                label="sales.saleorder"
                data={order as unknown as Record<string, unknown>}
            />
        ),
    },
    /**
     * stageSummary — Readable single-stage status for table queues (DTL-01).
     * StatusBadge-text renderer per component-decision-tree (status en tablas → StatusBadge legible).
     */
    stageSummary: {
        key: "status",
        type: "computed",
        fieldRole: "complex",
        label: "Estado",
        surfaces: ["table"],
        render: (order) => {
            const summary = orderStageSummary(order as SaleOrder)
            return (
                <div className="flex justify-center items-center w-full">
                    <StatusBadge status={summary.status} label={summary.label} intent={summary.intent} size="sm" />
                </div>
            )
        },
        tableOptions: {
            width: 140,
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
