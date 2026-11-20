import { defineEntity } from "@/components/entity-view"
import type { ProductionOrderPerformance } from "../analytics/productionPerformance.types"

/** Finished work orders of a product: planned vs real cost and margin (ADR-0146). */
export const productionOrderPerformanceEntity = defineEntity<ProductionOrderPerformance>()((f) => ({
    title: "Rendimiento por OT",
    fields: {
        number: f.code("number", { label: "OT" }),
        date: f.date("date", { label: "Terminada" }),
        qty: f.number("qty", { label: "Cantidad", decimals: 2 }),
        plannedCost: f.money("planned_cost", { label: "Costo planificado" }),
        realCost: f.money("real_cost", { label: "Costo real" }),
        deviation: f.money("deviation", { label: "Desviación", sign: "always" }),
        deviationPct: f.number("deviation_pct", { label: "Desv. %", decimals: 1, suffix: "%" }),
        revenue: f.money("revenue", { label: "Ingreso" }),
        margin: f.money("margin", { label: "Margen" }),
    },
}))

export const productionOrderPerformanceViews = productionOrderPerformanceEntity.views({
    table: {
        columns: ["number", "date", "qty", "plannedCost", "realCost", "deviation", "deviationPct", "revenue", "margin"],
        primary: "number",
    },
})
