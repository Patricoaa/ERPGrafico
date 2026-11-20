import { defineEntity } from "@/components/entity-view"
import type { ProductionMaterialPerformance } from "../analytics/productionPerformance.types"

/** Inputs consumed by a product's work orders: planned vs consumed quantity and cost effect (ADR-0146). */
export const productionMaterialPerformanceEntity = defineEntity<ProductionMaterialPerformance>()((f) => ({
    title: "Desviación por insumo",
    fields: {
        name: f.text("name", { label: "Insumo" }),
        plannedQty: f.number("planned_qty", { label: "Cant. planificada", decimals: 2 }),
        consumedQty: f.number("consumed_qty", { label: "Cant. consumida", decimals: 2 }),
        plannedCost: f.money("planned_cost", { label: "Costo planificado" }),
        realCost: f.money("real_cost", { label: "Costo real" }),
        deviation: f.money("deviation", { label: "Desviación", sign: "always" }),
    },
}))

export const productionMaterialPerformanceViews = productionMaterialPerformanceEntity.views({
    table: {
        columns: ["name", "plannedQty", "consumedQty", "plannedCost", "realCost", "deviation"],
        primary: "name",
    },
})
