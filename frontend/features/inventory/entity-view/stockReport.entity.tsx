"use client"

import { defineEntity } from "@/components/entity-view"

export interface StockReportItem {
    id: number | string
    name?: string
    code?: string
    internal_code?: string
    category_id?: number | string
    category_name?: string
    stock_qty?: number | string
    qty_reserved?: number | string
    qty_available?: number | string
    uom_name?: string
    uom_abbreviation?: string
    uom_display_stock?: string
    uom_display_reserved?: string
    uom_display_available?: string
    unit_cost?: number | string
    total_value?: number | string
}

export const stockReportEntity = defineEntity<StockReportItem>()((f) => ({
    title: "Existencias",
    fields: {
        name: f.text("name", { label: "Producto" }),
        stockQty: f.quantity(
            (item) => item.stock_qty ?? null,
            { label: "Stock", uom: (item) => item.uom_abbreviation || item.uom_name || "" },
        ),
        qtyReserved: f.quantity(
            (item) => item.qty_reserved ?? null,
            { label: "Reservado", uom: (item) => item.uom_abbreviation || item.uom_name || "" },
        ),
        qtyAvailable: f.quantity(
            (item) => item.qty_available ?? null,
            { label: "Disponible", uom: (item) => item.uom_abbreviation || item.uom_name || "" },
        ),
        totalValue: f.money(
            (item) => item.total_value ?? null,
            { label: "Valorización" },
        ),
    },
}))

export const stockReportViews = stockReportEntity.views({
    table: {
        columns: ["name", "stockQty", "qtyReserved", "qtyAvailable", "totalValue"],
        primary: "name",
    },
    card: {
        title: "name",
        meta: ["stockQty", "qtyAvailable"],
        trailing: ["totalValue"],
    },
})
