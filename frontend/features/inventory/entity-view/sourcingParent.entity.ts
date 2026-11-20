import { defineEntity } from "@/components/entity-view"
import type { SourcingParent } from "../analytics/sourcing.types"

/** Parent products whose active BOM uses the input, with cost share and price sensitivity (ADR-0147). */
export const sourcingParentEntity = defineEntity<SourcingParent>()((f) => ({
    title: "Productos que usan el insumo",
    fields: {
        name: f.text("name", { label: "Producto" }),
        qty: f.number("qty_per_unit", { label: "Cant. por unidad", decimals: 2 }),
        componentCost: f.money("component_cost", { label: "Costo del insumo" }),
        share: f.number("share_pct", { label: "Peso en la BOM", decimals: 1, suffix: "%" }),
        bomCost: f.money("bom_cost", { label: "Costo BOM" }),
        delta: f.money("delta_cost", { label: "Aumento de costo", sign: "always" }),
        deltaPct: f.number("delta_pct", { label: "Aumento %", decimals: 1, suffix: "%" }),
        margin: f.number("margin_pct", { label: "Margen actual", decimals: 1, suffix: "%" }),
        marginAfter: f.number("margin_pct_after", { label: "Margen tras el aumento", decimals: 1, suffix: "%" }),
    },
}))

export const sourcingParentViews = sourcingParentEntity.views({
    table: {
        columns: ["name", "qty", "componentCost", "share", "bomCost", "delta", "deltaPct", "margin", "marginAfter"],
        primary: "name",
    },
})
