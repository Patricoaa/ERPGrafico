import { Users } from "lucide-react"
import { defineEntity } from "@/components/entity-view"
import type { Group } from "../api/types"

/** Functional group (ADR-0087 oleada A1). Replaces groupFields.ts + renderCard. */
export const groupEntity = defineEntity<Group>()((f) => ({
    label: "settings.group",
    fields: {
        name: f.text("name", { label: "Nombre del Grupo" }),
        userCount: f.number("user_count", { label: "Miembros" }),
    },
}))

export const groupViews = groupEntity.views({
    table: { columns: ["name", "userCount"], defaultSort: "name" },
    card: { title: "name", meta: ["userCount"], media: { icon: Users } },
})
