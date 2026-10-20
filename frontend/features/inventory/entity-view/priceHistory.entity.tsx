"use client"

import { defineEntity } from "@/components/entity-view"

export interface PriceHistoryEntry {
    date: string
    sale_price: number
    /** Computed client-side: sale_price × ivaRatio (injected before passing to the collection). */
    sale_price_gross?: number
    cost_price: number
    user: string
}

export const priceHistoryEntity = defineEntity<PriceHistoryEntry>()((f) => ({
    title: "Historial de Precios",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        user: f.text("user", { label: "Usuario", tone: "secondary" }),
        salePriceGross: f.money(
            (e) => e.sale_price_gross ?? null,
            { label: "Precio c/IVA" },
        ),
        salePrice: f.money("sale_price", { label: "Precio Neto" }),
    },
}))

export const priceHistoryViews = priceHistoryEntity.views({
    table: {
        columns: ["date", "user", "salePriceGross", "salePrice"],
        primary: "salePriceGross",
    },
})

export const costHistoryEntity = defineEntity<PriceHistoryEntry>()((f) => ({
    title: "Historial de Costos",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        user: f.text("user", { label: "Usuario", tone: "secondary" }),
        costPrice: f.money("cost_price", { label: "Costo Ponderado" }),
    },
}))

export const costHistoryViews = costHistoryEntity.views({
    table: {
        columns: ["date", "user", "costPrice"],
        primary: "costPrice",
    },
})
