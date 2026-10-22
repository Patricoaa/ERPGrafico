import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import type { InventoryDocumentDetail } from "../types"

/**
 * Lines of an inventory document, inside its ADR-0083 document sheet (ADR-0087 oleada B3).
 * Read-only, no sheet of its own: `title` instead of `label` (define-entity.ts "embedded rows").
 */
export const inventoryDocumentDetailEntity = defineEntity<InventoryDocumentDetail>()((f) => ({
    title: "Productos",
    fields: {
        product: docRef(f, (d) => (d.product ? { label: "inventory.product", id: d.product, display: d.product_name } : null), { label: "Producto" }),
        warehouse: f.text((d) => (d.source_warehouse_name ? `${d.source_warehouse_name} → ${d.warehouse_name}` : d.warehouse_name), { label: "Bodega" }),
        quantity: f.quantity((d) => d.quantity, { label: "Cantidad", uom: (d) => d.uom_name }),
        unitCost: f.money("unit_cost", { label: "Costo unit." }),
    },
}))

export const inventoryDocumentDetailViews = inventoryDocumentDetailEntity.views({
    table: { columns: ["product", "warehouse", "quantity", "unitCost"], primary: "product" },
})
