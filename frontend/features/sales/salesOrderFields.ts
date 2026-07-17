import { createEntityFields } from "@/components/shared"
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
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        surfaces: ["card", "kanban"],
    },
})
