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
    // ADR-0158 §3, client mode: rows filter (`search.filterFn`) and sort in the browser.
    query: {
        search: { placeholder: "Buscar categoría…" },
        filters: { is_active: { field: "isActive", control: "single", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Archivado" }] } },
        sort: { fields: ["name", "code", "isActive"], default: "name" },
        views: [
            { id: "all", label: "Todas" },
            { id: "active", label: "Activas", filters: { is_active: "true" } },
            { id: "archived", label: "Archivadas", filters: { is_active: "false" } },
        ],
    },
}))

export const uomCategoryViews = uomCategoryEntity.views({
    table: { columns: ["code", "name", "isActive"], primary: "name" },
    card: { title: "name", trailing: ["code", "isActive"] },
})
