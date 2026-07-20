import { createEntityFields } from "@/components/shared"
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
        surfaces: ["card", "kanban"],
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        surfaces: ["card", "kanban"],
    },
})
