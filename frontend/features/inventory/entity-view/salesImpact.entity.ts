import { defineEntity } from "@/components/entity-view"
import type { SalesImpactRow } from "../analytics/salesImpact.types"

/** Segment table of the "Precio y margen" analytics block (ADR-0145). */
export const salesImpactEntity = defineEntity<SalesImpactRow>()((f) => ({
    title: "Impacto en ventas",
    fields: {
        label: f.text("label", { label: "Segmento" }),
        units: f.number("units", { label: "Unidades", decimals: 0 }),
        netRevenue: f.money("net_revenue", { label: "Ingreso neto" }),
        margin: f.money("margin", { label: "Margen" }),
        marginPct: f.number("margin_pct", { label: "Margen %", decimals: 1, suffix: "%" }),
        discount: f.money("discount_total", { label: "Descuento" }),
        avgPrice: f.money("avg_price", { label: "Precio medio" }),
        foregone: f.money("foregone_revenue", { label: "Ingreso no percibido" }),
    },
}))

export const salesImpactViews = salesImpactEntity.views({
    table: {
        columns: ["label", "units", "netRevenue", "margin", "marginPct", "discount", "avgPrice", "foregone"],
        primary: "label",
    },
})
