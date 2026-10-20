"use client"

import { defineEntity } from "@/components/entity-view"
import { formatEntityDisplay } from "@/lib/entity-registry"

export interface ProductionUsage {
    date: string
    ot_id: number
    ot_number: string
    quantity: number
    description: string
}

export const productionUsageEntity = defineEntity<ProductionUsage>()((f) => ({
    title: "Uso en Producción",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        otNumber: f.code(
            (u) => formatEntityDisplay('production.workorder', { number: u.ot_number }),
            { label: "N° OT" },
        ),
        quantity: f.quantity("quantity", { label: "Cantidad Consumida" }),
    },
}))

export const productionUsageViews = productionUsageEntity.views({
    table: {
        columns: ["date", "otNumber", "quantity"],
        primary: "otNumber",
    },
})
