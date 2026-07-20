import { createEntityFields } from "@/components/shared"
import { DomainHubStatus } from "@/components/shared"
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
        type: "complex",
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
})
