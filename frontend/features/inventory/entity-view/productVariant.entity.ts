import { defineEntity } from "@/components/entity-view"
import type { Product } from "@/types/entities"

/**
 * Variants of a product template, in the product record's Variants tab (ADR-0087): SKU, attribute
 * values, price inheritance, effective price, bill of materials and availability. Rows are selected
 * to edit them in the side panel (one or several at once).
 */

const PRICE_MODE = {
    INHERIT: { label: "Hereda", intent: "neutral" },
    SURCHARGE: { label: "+Sobrecargo", intent: "warning" },
    OVERRIDE: { label: "Propio", intent: "primary" },
} as const

const stock = (v: Product) => v.current_stock ?? 0
const fixed = { sortable: false } as const

export const productVariantEntity = defineEntity<Product>()((f) => ({
    title: "Variante",
    fields: {
        sku: f.code((v) => v.internal_code || v.code || "Sin SKU", { ...fixed, label: "SKU" }),
        attributes: f.tags((v) => (v.attribute_values_data ?? []).map((av) => String(av.value)), { ...fixed, label: "Atributos" }),
        priceMode: f.status((v) => {
            const mode = v.price_inheritance_mode ?? "INHERIT"
            const shown = PRICE_MODE[mode as keyof typeof PRICE_MODE] ?? PRICE_MODE.INHERIT
            return { status: mode, label: shown.label, intent: shown.intent }
        }, { ...fixed, label: "Modo de precio" }),
        price: f.money((v) => Number(v.effective_price_net ?? v.sale_price), { ...fixed, label: "Precio" }),
        bom: f.status((v) => {
            if (v.has_active_bom) return { status: "WITH_BOM", label: "Con LDM", intent: "success" }
            // Auto-finishing manufacture needs a bill of materials: missing one is a problem.
            return v.mfg_auto_finalize ? { status: "WITHOUT_BOM", label: "Sin LDM", intent: "destructive" } : null
        }, { ...fixed, label: "LDM" }),
        availability: f.status((v) => {
            // Made to order without a BOM: available on demand, not from stock.
            if (!v.has_active_bom && (v.product_type === "MANUFACTURABLE" || v.requires_advanced_manufacturing)) {
                return { status: "ON_DEMAND", label: "Disponible", intent: "primary" }
            }
            return { status: stock(v) > 0 ? "IN_STOCK" : "OUT_OF_STOCK", label: `Stock: ${stock(v)}`, intent: stock(v) > 0 ? "success" : "destructive" }
        }, { ...fixed, label: "Disp." }),
    },
}))

export const productVariantViews = productVariantEntity.views({
    table: { columns: ["sku", "attributes", "priceMode", "price", "bom", "availability"], primary: "sku" },
})
