import { createEntityFields } from "@/components/shared"
import type { Category } from "./hooks/useCategories"

export const categoryFields = createEntityFields<Category>()({
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
    parentName: {
        key: "parent_name",
        type: "secondary",
        label: "Categoría Padre",
    },
}, {
    title: { field: 'name' },
})
