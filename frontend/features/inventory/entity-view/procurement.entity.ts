import { defineEntity } from "@/components/entity-view"
import type { ProcurementPendingRow, ProcurementSupplierRow } from "../analytics/procurement.types"

/** Supplier row of the "Abastecimiento" tab; `preferred_label` marks the product's preferred supplier. */
export interface ProcurementSupplierTableRow extends Omit<ProcurementSupplierRow, "preferred"> {
    preferred_label: string
}

export const procurementSuppliersEntity = defineEntity<ProcurementSupplierTableRow>()((f) => ({
    title: "Proveedores",
    fields: {
        name: f.text("name", { label: "Proveedor" }),
        preferred: f.text("preferred_label", { label: "Preferencia", tone: "secondary" }),
        units: f.number("units", { label: "Unidades", decimals: 0 }),
        spend: f.money("spend", { label: "Gasto" }),
        share: f.number("share_pct", { label: "% del gasto", decimals: 1, suffix: "%" }),
        avgCost: f.money("avg_unit_cost", { label: "Precio promedio" }),
        receipts: f.number("receipts", { label: "Recepciones", decimals: 0 }),
        lastDate: f.date("last_date", { label: "Última compra" }),
        returned: f.number("returned_units", { label: "Devueltas", decimals: 0 }),
    },
}))

export const procurementSuppliersViews = procurementSuppliersEntity.views({
    table: {
        columns: ["name", "preferred", "units", "spend", "share", "avgCost", "receipts", "lastDate", "returned"],
        primary: "name",
    },
})

export const procurementPendingEntity = defineEntity<ProcurementPendingRow>()((f) => ({
    title: "Pendiente de recibir",
    fields: {
        number: f.text("number", { label: "Orden" }),
        supplier: f.text("supplier", { label: "Proveedor" }),
        date: f.date("date", { label: "Fecha" }),
        ordered: f.number("ordered", { label: "Pedido", decimals: 0 }),
        received: f.number("received", { label: "Recibido", decimals: 0 }),
        pending: f.number("pending", { label: "Pendiente", decimals: 0 }),
    },
}))

export const procurementPendingViews = procurementPendingEntity.views({
    table: { columns: ["number", "supplier", "date", "ordered", "received", "pending"], primary: "number" },
})
