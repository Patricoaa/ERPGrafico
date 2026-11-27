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
    // ADR-0158 §3, client mode: the report loads every product; filters and sorting run in the browser.
    query: {
        search: { placeholder: "Buscar por producto o SKU…" },
        filters: {
            category: { label: "Categoría", control: "single", options: "remote" },
            // The only server filter: the report is computed per warehouse.
            warehouse: { label: "Bodega", control: "single", param: "warehouse_id", options: "remote" },
            stock_qty: { field: "stockQty", control: "range", paramFrom: "stock_qty_from", paramTo: "stock_qty_to" },
            qty_available: { field: "qtyAvailable", control: "range", paramFrom: "qty_available_from", paramTo: "qty_available_to" },
            qty_reserved: { field: "qtyReserved", control: "range", paramFrom: "qty_reserved_from", paramTo: "qty_reserved_to" },
            total_value: { field: "totalValue", control: "range", paramFrom: "total_value_from", paramTo: "total_value_to" },
        },
        sort: { fields: ["name", "stockQty", "qtyReserved", "qtyAvailable", "totalValue"] },
        views: [{ id: "all", label: "Todos" }],
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
