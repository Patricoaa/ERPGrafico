import { defineEntity } from "@/components/entity-view"
import { translateStatus } from "@/lib/utils"

export interface SubscriptionOrderEntry {
    id: number
    number: string
    display_id: string
    date: string
    status: string
    total: number
    receiving_status: string
    payment_status?: string
}

const fixed = { sortable: false } as const

export const subscriptionOrderEntity = defineEntity<SubscriptionOrderEntry>()((f) => ({
    label: "purchasing.purchaseorder",
    fields: {
        displayId: f.text("display_id", { ...fixed, label: "Documento" }),
        date: f.date("date", { ...fixed, label: "Fecha" }),
        status: f.status(
            (r) => ({
                status: r.payment_status === "PAID" || r.receiving_status === "RECEIVED" ? "SUCCESS" : "NEUTRAL",
                label: translateStatus(r.status),
            }),
            { ...fixed, label: "Estado" }
        ),
        total: f.money("total", { ...fixed, label: "Monto Total" }),
    },
}))

export const subscriptionOrderViews = subscriptionOrderEntity.views({
    table: { columns: ["displayId", "date", "status", "total"] },
})
