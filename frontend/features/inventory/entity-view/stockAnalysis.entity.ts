import { defineEntity } from "@/components/entity-view"
import type { StockAdjustmentRow, StockFlowRow, StockVariantRow } from "../analytics/stockAnalysis.types"

/** Warehouse row of the "Inventario" tab; `status` says «Inmóvil» when it holds stock without recent moves. */
export interface StockWarehouseTableRow {
    name: string
    on_hand: number
    last_move_date: string | null
    status: string
}

export const stockWarehousesEntity = defineEntity<StockWarehouseTableRow>()((f) => ({
    title: "Bodegas",
    fields: {
        name: f.text("name", { label: "Bodega" }),
        onHand: f.number("on_hand", { label: "En bodega", decimals: 2 }),
        lastMove: f.date("last_move_date", { label: "Último movimiento" }),
        status: f.text("status", { label: "Estado", tone: "secondary" }),
    },
}))

export const stockWarehousesViews = stockWarehousesEntity.views({
    table: { columns: ["name", "onHand", "lastMove", "status"], primary: "name" },
})

export const stockVariantsEntity = defineEntity<StockVariantRow>()((f) => ({
    title: "Variantes",
    fields: {
        name: f.text("name", { label: "Variante" }),
        onHand: f.number("on_hand", { label: "En stock", decimals: 2 }),
        reserved: f.number("reserved", { label: "Reservado", decimals: 2 }),
        available: f.number("available", { label: "Libre", decimals: 2 }),
    },
}))

export const stockVariantsViews = stockVariantsEntity.views({
    table: { columns: ["name", "onHand", "reserved", "available"], primary: "name" },
})

export const stockFlowsEntity = defineEntity<StockFlowRow>()((f) => ({
    title: "Flujos",
    fields: {
        label: f.text("label", { label: "Concepto" }),
        qty: f.number("qty", { label: "Unidades", decimals: 2 }),
    },
}))

export const stockFlowsViews = stockFlowsEntity.views({
    table: { columns: ["label", "qty"], primary: "label" },
})

export const stockAdjustmentsEntity = defineEntity<StockAdjustmentRow>()((f) => ({
    title: "Ajustes",
    fields: {
        label: f.text("label", { label: "Tipo" }),
        qty: f.number("qty", { label: "Unidades", decimals: 2 }),
        value: f.money("value", { label: "Valorizado" }),
    },
}))

export const stockAdjustmentsViews = stockAdjustmentsEntity.views({
    table: { columns: ["label", "qty", "value"], primary: "label" },
})
