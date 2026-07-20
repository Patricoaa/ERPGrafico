import { createEntityFields } from "@/components/shared"
import type { Group } from "./api/types"

export const groupFields = createEntityFields<Group>()({
    name: {
        key: "name",
        type: "text",
        label: "Nombre del Grupo",
    },
    userCount: {
        key: "user_count",
        type: "number",
        label: "Miembros",
    },
})
