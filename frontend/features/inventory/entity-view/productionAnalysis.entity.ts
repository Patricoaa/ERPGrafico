import { defineEntity } from "@/components/entity-view"
import type { InputByProduct, MadeMaterial, SourcingParent } from "../analytics/productionAnalysis.types"

export const madeMaterialsEntity = defineEntity<MadeMaterial>()((f) => ({
    title: "Insumos",
    fields: {
        name: f.text("name", { label: "Insumo" }),
        planned: f.number("planned_qty", { label: "Planificado", decimals: 2 }),
        consumed: f.number("consumed_qty", { label: "Consumido", decimals: 2 }),
        deviation: f.number("deviation_qty", { label: "Diferencia", decimals: 2 }),
        deviationPct: f.number("deviation_pct", { label: "Diferencia %", decimals: 1, suffix: "%" }),
    },
}))

export const madeMaterialsViews = madeMaterialsEntity.views({
    table: { columns: ["name", "planned", "consumed", "deviation", "deviationPct"], primary: "name" },
})

/** Finished order row; `status` says «Rectificada» when the order was reworked. */
export interface MadeOrderRow {
    number: string
    date: string
    units: number
    status: string
}

export const madeOrdersEntity = defineEntity<MadeOrderRow>()((f) => ({
    title: "Órdenes terminadas",
    fields: {
        number: f.text("number", { label: "Orden" }),
        date: f.date("date", { label: "Terminada" }),
        units: f.number("units", { label: "Unidades", decimals: 0 }),
        status: f.text("status", { label: "Estado", tone: "secondary" }),
    },
}))

export const madeOrdersViews = madeOrdersEntity.views({
    table: { columns: ["number", "date", "units", "status"], primary: "number" },
})

export const inputByProductEntity = defineEntity<InputByProduct>()((f) => ({
    title: "Consumo por producto",
    fields: {
        name: f.text("name", { label: "Producto fabricado" }),
        qty: f.number("qty", { label: "Consumido", decimals: 2 }),
        share: f.number("share_pct", { label: "% del consumo", decimals: 1, suffix: "%" }),
    },
}))

export const inputByProductViews = inputByProductEntity.views({
    table: { columns: ["name", "qty", "share"], primary: "name" },
})

export const inputUsedInEntity = defineEntity<SourcingParent>()((f) => ({
    title: "Productos que lo usan",
    fields: {
        name: f.text("name", { label: "Producto" }),
        qty: f.number("qty_per_unit", { label: "Cantidad por unidad", decimals: 4 }),
        share: f.number("share_pct", { label: "% de su BOM", decimals: 1, suffix: "%" }),
        margin: f.number("margin_pct", { label: "Margen hoy", decimals: 1, suffix: "%" }),
        marginAfter: f.number("margin_pct_after", { label: "Margen tras la subida", decimals: 1, suffix: "%" }),
    },
}))

export const inputUsedInViews = inputUsedInEntity.views({
    table: { columns: ["name", "qty", "share", "margin", "marginAfter"], primary: "name" },
})
