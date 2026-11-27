import { Warehouse as WarehouseIcon } from "lucide-react"
import { defineEntity } from "@/components/entity-view"
import { formatQuantity } from "@/lib/money"
import type { Warehouse } from "../hooks/useWarehouses"

function stockedProductsLabel(warehouse: Warehouse): string | undefined {
    if (warehouse.stocked_product_count == null) return undefined
    return warehouse.stocked_product_count === 1
        ? "1 producto"
        : `${formatQuantity(warehouse.stocked_product_count)} productos`
}

/** Warehouse (ADR-0087 oleada A1). Replaces warehouseFields.ts + the select column + renderCard. */
export const warehouseEntity = defineEntity<Warehouse>()((f) => ({
    label: "inventory.warehouse",
    fields: {
        name: f.text("name", { label: "Nombre del Almacén" }),
        code: f.code("code", { label: "Código Interno" }),
        address: f.text("address", { label: "Dirección", tone: "secondary" }),
        stockedProductCount: f.number("stocked_product_count", { label: "Productos", decimals: 0 }),
        stockUnits: f.number("stock_units", { label: "Unidades", decimals: 0 }),
        isActive: f.status((w) => (w.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
    // ADR-0158 §3, client mode: rows filter (`search.filterFn`) and sort in the browser.
    query: {
        search: { placeholder: "Buscar almacén…", scopes: [{ label: "Nombre / Código", param: "name", clientKey: ["name", "code", "address"] }] },
        filters: { is_active: { field: "isActive", control: "single", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Archivado" }] } },
        sort: { fields: ["name", "code", "address", "stockedProductCount", "stockUnits", "isActive"], default: "name" },
        views: [
            { id: "all", label: "Todos" },
            { id: "active", label: "Activos", filters: { is_active: "true" } },
            { id: "archived", label: "Archivados", filters: { is_active: "false" } },
        ],
    },
}))

export const warehouseViews = warehouseEntity.views({
    table: { columns: ["name", "code", "address", "isActive"] },
    card: {
        title: "name",
        subtitle: ["address"],
        footer: { value: "stockUnits" },
        muted: (w) => !w.is_active,
        media: {
            placement: "top",
            icon: WarehouseIcon,
            badge: (w) => (w.is_active ? w.code : "Archivado"),
            footnote: stockedProductsLabel,
        },
    },
})
