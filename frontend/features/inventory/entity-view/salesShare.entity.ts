import { defineEntity } from "@/components/entity-view"
import type { SalesCustomerRow, SalesShareRow } from "../analytics/sales.types"

/** Top customers of the "Ventas" tab, with their share of the net revenue. */
export const salesCustomersEntity = defineEntity<SalesCustomerRow>()((f) => ({
    title: "Mejores clientes",
    fields: {
        name: f.text("name", { label: "Cliente" }),
        units: f.number("units", { label: "Unidades", decimals: 0 }),
        netRevenue: f.money("net_revenue", { label: "Ingreso neto" }),
        share: f.number("share_pct", { label: "% del ingreso", decimals: 1, suffix: "%" }),
    },
}))

export const salesCustomersViews = salesCustomersEntity.views({
    table: { columns: ["name", "units", "netRevenue", "share"], primary: "name" },
})

/** Channel, variant and unit-of-measure splits of the "Ventas" tab. */
export const salesSharesEntity = defineEntity<SalesShareRow>()((f) => ({
    title: "Reparto de ventas",
    fields: {
        label: f.text("label", { label: "Segmento" }),
        units: f.number("units", { label: "Unidades", decimals: 0 }),
        netRevenue: f.money("net_revenue", { label: "Ingreso neto" }),
        share: f.number("share_pct", { label: "% del ingreso", decimals: 1, suffix: "%" }),
    },
}))

export const salesSharesViews = salesSharesEntity.views({
    table: { columns: ["label", "units", "netRevenue", "share"], primary: "label" },
})
