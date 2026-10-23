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
    // Compact document/rail variant: no catalog media band. Groups have no state of their own,
    // so the leading rail only carries a decorative identity icon, not a status.
    card: {
        title: "name",
        meta: ["userCount"],
        rail: { status: () => null, icon: Users },
    },
})
