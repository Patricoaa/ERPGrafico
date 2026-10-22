"use client"

import { defineEntity } from "@/components/entity-view"

export interface TopSupplier {
    name: string
    total_cost: number
    total_qty: number
}

export const topSupplierEntity = defineEntity<TopSupplier>()((f) => ({
    title: "Top Proveedores",
    fields: {
        name: f.text("name", { label: "Proveedor" }),
        totalQty: f.quantity("total_qty", { label: "Unidades" }),
        totalCost: f.money("total_cost", { label: "Costo Total" }),
    },
}))

export const topSupplierViews = topSupplierEntity.views({
    table: {
        columns: ["name", "totalQty", "totalCost"],
        primary: "name",
    },
})
