import { defineEntity } from "@/components/entity-view"
import type { CostsWorkOrder } from "../analytics/costs.types"

/** One line of the active BOM, per produced unit, with the component's cost change in the period. */
export interface CostsBomRow {
    name: string
    source: string
    qty_per_unit: number
    unit_cost: number
    cost: number
    share_pct: number
    change_pct: number | null
}

export const costsBomEntity = defineEntity<CostsBomRow>()((f) => ({
    title: "Composición de la BOM",
    fields: {
        name: f.text("name", { label: "Componente" }),
        source: f.text("source", { label: "Origen", tone: "secondary" }),
        qty: f.number("qty_per_unit", { label: "Cantidad por unidad", decimals: 4 }),
        unitCost: f.money("unit_cost", { label: "Costo unitario" }),
        cost: f.money("cost", { label: "Costo en la BOM" }),
        share: f.number("share_pct", { label: "% de la BOM", decimals: 1, suffix: "%" }),
        change: f.number("change_pct", { label: "Variación", decimals: 1, suffix: "%" }),
    },
}))

export const costsBomViews = costsBomEntity.views({
    table: { columns: ["name", "source", "qty", "unitCost", "cost", "share", "change"], primary: "name" },
})

export const costsWorkOrdersEntity = defineEntity<CostsWorkOrder>()((f) => ({
    title: "Órdenes de trabajo",
    fields: {
        number: f.text("number", { label: "Orden" }),
        date: f.date("date", { label: "Terminada" }),
        units: f.number("units", { label: "Unidades", decimals: 0 }),
        real: f.money("unit_real_cost", { label: "Costo real unitario" }),
        planned: f.money("unit_bom_cost", { label: "Costo planificado unitario" }),
        deviation: f.number("deviation_pct", { label: "Desvío", decimals: 1, suffix: "%" }),
    },
}))

export const costsWorkOrdersViews = costsWorkOrdersEntity.views({
    table: { columns: ["number", "date", "units", "real", "planned", "deviation"], primary: "number" },
})
