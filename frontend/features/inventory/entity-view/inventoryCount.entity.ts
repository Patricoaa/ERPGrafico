import { defineEntity } from "@/components/entity-view"
import type { InventoryCount } from "../types"

/**
 * Inventory count sessions list (ADR-0087 oleada B3). Only the list: the editable lines table
 * inside the detail drawer stays on the legacy system until the oleada E (edición).
 */
export const inventoryCountEntity = defineEntity<InventoryCount>()((f) => ({
    label: "inventory.inventorycount",
    fields: {
        folio: f.code((c) => `#${c.id}`, { label: "Folio" }),
        warehouse: f.text("warehouse_name", { label: "Almacén" }),
        status: f.status((c) => ({ status: c.status }), { label: "Estado" }),
        createdBy: f.text("created_by_name", { label: "Creado por", tone: "secondary" }),
        progress: f.progress((c) => ({ done: c.counted_products, total: c.total_products }), { label: "Progreso", format: "ratio" }),
        differences: f.status((c) => (c.products_with_difference > 0
            ? { status: "WARNING", label: `${c.products_with_difference} diferencias` }
            : null
        ), { label: "Diferencias" }),
    },
}))

export const inventoryCountViews = inventoryCountEntity.views({
    table: { columns: ["folio", "warehouse", "status", "createdBy", "progress", "differences"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "folio",
        subtitle: ["warehouse", "createdBy"],
        trailing: ["status"],
        meta: ["progress", "differences"],
    },
})
