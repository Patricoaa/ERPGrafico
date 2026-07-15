import { createEntityFields } from "@/components/shared"
import type { UoM } from "./hooks/useUoMs"

export const uomFields = createEntityFields<UoM>()({
    id: {
        key: "id",
        type: "code",
        label: "Código Interno",
        tableOptions: { width: 80 },
    },
    name: {
        key: "name",
        type: "text",
        label: "Nombre",
    },
    categoryName: {
        key: "category_name",
        type: "secondary",
        label: "Categoría",
    },
    uomType: {
        key: "uom_type",
        type: "status",
        label: "Tipo",
    },
})
