import { createEntityFields } from "@/components/shared"
import type { Warehouse } from "./hooks/useWarehouses"

export const warehouseFields = createEntityFields<Warehouse>()({
    name: {
        key: "name",
        type: "text",
        label: "Nombre del Almacén",
    },
    code: {
        key: "code",
        type: "code",
        label: "Código Interno",
        tableOptions: { width: 120 },
    },
    address: {
        key: "address",
        type: "secondary",
        label: "Dirección",
    },
})
