import { createEntityFields } from "@/components/shared"
import type { InventoryDocument } from "./types"

export const inventoryDocumentFields = createEntityFields<InventoryDocument>()({
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
        tableOptions: { width: 90 },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        tableOptions: { width: 100 },
        cardPlacement: "header-right",
    },
})
