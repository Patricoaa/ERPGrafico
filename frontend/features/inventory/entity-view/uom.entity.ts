import { Ruler } from "lucide-react"
import { defineEntity, type StatusValue } from "@/components/entity-view"
import type { UoM } from "../hooks/useUoMs"

const UOM_TYPE: Record<UoM["uom_type"], StatusValue> = {
    REFERENCE: { status: "INFO", label: "Referencia" },
    BIGGER: { status: "SUCCESS", label: "Mayor" },
    SMALLER: { status: "WARNING", label: "Menor" },
}

/** UoM — trivial catalog (spike, ADR-0087). Replaces uomFields.ts + inline columns + renderCard. */
export const uomEntity = defineEntity<UoM>()((f) => ({
    label: "inventory.uom",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        abbreviation: f.code("abbreviation", { label: "Abreviación" }),
        category: f.text("category_name", { label: "Categoría", tone: "secondary" }),
        type: f.status((u) => UOM_TYPE[u.uom_type], { label: "Tipo" }),
        isActive: f.status((u) => (u.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
        // Row-aware option: 0.001 g must not render as "0,00".
        ratio: f.number("ratio", { label: "Ratio", decimals: (u) => (Number(u.ratio) % 1 === 0 ? 0 : 3) }),
    },
    // ADR-0158 §3, client mode: the server filters, the browser sorts.
    query: {
        search: { placeholder: "Buscar unidad…" },
        filters: { is_active: { field: "isActive", control: "single", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Archivado" }] } },
        sort: { fields: ["name", "abbreviation", "category", "type", "isActive", "ratio"], default: "name" },
        groupBy: { fields: ["category", "type"] },
        views: [
            { id: "all", label: "Todas" },
            { id: "active", label: "Activas", filters: { is_active: "true" } },
            { id: "archived", label: "Archivadas", filters: { is_active: "false" } },
        ],
    },
}))

export const uomViews = uomEntity.views({
    table: { columns: ["name", "abbreviation", "category", "type", "isActive", "ratio"] },
    card: { rail: { status: (u) => (u.is_active ? "active" : "inactive"), icon: Ruler }, title: "name", subtitle: ["abbreviation", "category"], trailing: ["type", "isActive"] },
})
