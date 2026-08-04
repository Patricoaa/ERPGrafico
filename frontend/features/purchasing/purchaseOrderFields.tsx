import { createEntityFields, DataCell, DomainHubStatus } from "@/components/shared"
import type { PurchaseOrderAPI } from "./types"

export const purchaseOrderFields = createEntityFields<PurchaseOrderAPI>()({
    displayId: {
        key: "number",
        type: "code",
        label: "Folio",
        get: (o) => o.display_id ?? o.number,
    },
    contactDisplayName: {
        key: "supplier_name",
        type: "text",
        label: "Proveedor",
    },
    orderDate: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    expectedDeliveryDate: {
        key: "receipt_date",
        type: "date",
        label: "Entrega Esperada",
    },
    domainStatus: {
        key: "status",
        type: "computed",
        fieldRole: "complex",
        label: "Estado",
        render: (order) => (
            <DomainHubStatus
                label="purchasing.purchaseorder"
                data={order as unknown as Record<string, unknown>}
            />
        ),
        tableOptions: {
            width: 180,
            align: "center",
            enableSorting: false,
        },
    },
    workflow: {
        key: "workflow",
        type: "computed",
        fieldRole: "complex",
        label: "Resumen",
        surfaces: ["table"],
        render: (order) => {
            const o = order;
            return (
                <DataCell.WorkflowSummary
                    lines={o.lines}
                    total={parseFloat(String(o.total || 0))}
                    pending={parseFloat(String(o.pending_amount || 0))}
                    deliveryDate={o.receipt_date ?? undefined}
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
