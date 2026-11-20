import { defineEntity } from "@/components/entity-view"

/** One row of "Antes vs después": a price change or rule boundary with 28-day windows on each side. */
export interface PricingEffectRow {
    label: string
    date: string
    units_per_day_before: number
    units_per_day_after: number
    revenue_per_day_before: number
    revenue_per_day_after: number
    margin_per_unit_before: number | null
    margin_per_unit_after: number | null
    reliability: string
}

export const pricingEffectsEntity = defineEntity<PricingEffectRow>()((f) => ({
    title: "Antes vs después",
    fields: {
        label: f.text("label", { label: "Cambio" }),
        date: f.date("date", { label: "Fecha" }),
        unitsBefore: f.number("units_per_day_before", { label: "Unid./día antes", decimals: 2 }),
        unitsAfter: f.number("units_per_day_after", { label: "Unid./día después", decimals: 2 }),
        revenueBefore: f.money("revenue_per_day_before", { label: "Ingreso/día antes" }),
        revenueAfter: f.money("revenue_per_day_after", { label: "Ingreso/día después" }),
        marginBefore: f.money("margin_per_unit_before", { label: "Margen/unid. antes" }),
        marginAfter: f.money("margin_per_unit_after", { label: "Margen/unid. después" }),
        reliability: f.text("reliability", { label: "Confianza", tone: "secondary" }),
    },
}))

export const pricingEffectsViews = pricingEffectsEntity.views({
    table: {
        columns: [
            "label", "date", "unitsBefore", "unitsAfter", "revenueBefore", "revenueAfter",
            "marginBefore", "marginAfter", "reliability",
        ],
        primary: "label",
    },
})
