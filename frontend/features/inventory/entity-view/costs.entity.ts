import { defineEntity } from "@/components/entity-view"
import type { CostsPurchaseItem, CostsWorkOrder } from "../analytics/costs.types"

export const costsWorkOrdersEntity = defineEntity<CostsWorkOrder>()((f) => ({
    title: "Órdenes de trabajo",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        number: f.text("number", { label: "Orden" }),
        real: f.money("unit_real_cost", { label: "Costo unitario" }),
    },
}))

export const costsWorkOrdersViews = costsWorkOrdersEntity.views({
    table: { columns: ["date", "number", "real"], primary: "number" },
})

export const costsPurchasesEntity = defineEntity<CostsPurchaseItem>()((f) => ({
    title: "Compras",
    fields: {
        number: f.text("number", { label: "Recepción" }),
        date: f.date("date", { label: "Fecha" }),
        supplier: f.text("supplier", { label: "Proveedor" }),
        qty: f.number("qty", { label: "Cantidad", decimals: 2 }),
        unitCost: f.money("unit_cost", { label: "Costo unitario" }),
        total: f.money("total", { label: "Total" }),
    },
}))

export const costsPurchasesViews = costsPurchasesEntity.views({
    table: { columns: ["number", "date", "supplier", "qty", "unitCost", "total"], primary: "number" },
})
