import { defineEntity } from "@/components/entity-view"
import type { Warehouse } from "../hooks/useWarehouses"

/** Warehouse (ADR-0087 oleada A1). Replaces warehouseFields.ts + the select column + renderCard. */
export const warehouseEntity = defineEntity<Warehouse>()((f) => ({
    label: "inventory.warehouse",
    fields: {
        name: f.text("name", { label: "Nombre del Almacén" }),
        code: f.code("code", { label: "Código Interno" }),
        address: f.text("address", { label: "Dirección", tone: "secondary" }),
    },
}))

export const warehouseViews = warehouseEntity.views({
    table: { columns: ["name", "code", "address"], defaultSort: "name" },
    card: { title: "name", subtitle: ["code"], meta: ["address"] },
})
