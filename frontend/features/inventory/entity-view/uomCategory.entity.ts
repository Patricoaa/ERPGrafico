import { defineEntity } from "@/components/entity-view"
import type { UoMCategory } from "../hooks/useUoMs"

/** UoM category (ADR-0087 oleada A1). Replaces uomCategoryFields.ts + the select column + renderCard. */
export const uomCategoryEntity = defineEntity<UoMCategory>()((f) => ({
    label: "inventory.uomcategory",
    fields: {
        code: f.code("id", { label: "Código" }),
        name: f.text("name", { label: "Nombre" }),
        isActive: f.status((c) => (c.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
}))

export const uomCategoryViews = uomCategoryEntity.views({
    table: { columns: ["code", "name", "isActive"], primary: "name", defaultSort: "name" },
    card: { title: "name", trailing: ["code", "isActive"] },
})
