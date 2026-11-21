import { defineEntity } from "@/components/entity-view"
import type { SubscriptionPayment } from "../analytics/subscriptionAnalysis.types"

/** Subscription row of the "Suscripción" tab, with status and frequency already labelled. */
export interface SubscriptionTableRow {
    supplier: string
    status_label: string
    frequency_label: string
    amount: number
    annualized: number
    next_payment_date: string | null
    end_date: string | null
    last_payment_amount: number | null
    change_pct: number | null
}

export const subscriptionRowsEntity = defineEntity<SubscriptionTableRow>()((f) => ({
    title: "Suscripciones",
    fields: {
        supplier: f.text("supplier", { label: "Proveedor" }),
        status: f.text("status_label", { label: "Estado", tone: "secondary" }),
        frequency: f.text("frequency_label", { label: "Frecuencia" }),
        amount: f.money("amount", { label: "Monto configurado" }),
        annualized: f.money("annualized", { label: "Anualizado" }),
        nextPayment: f.date("next_payment_date", { label: "Próximo pago" }),
        end: f.date("end_date", { label: "Termina" }),
        lastPayment: f.money("last_payment_amount", { label: "Último pago" }),
        change: f.number("change_pct", { label: "Variación", decimals: 1, suffix: "%" }),
    },
}))

export const subscriptionRowsViews = subscriptionRowsEntity.views({
    table: {
        columns: ["supplier", "status", "frequency", "amount", "annualized", "nextPayment", "end", "lastPayment", "change"],
        primary: "supplier",
    },
})

export const subscriptionPaymentsEntity = defineEntity<SubscriptionPayment>()((f) => ({
    title: "Pagos",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        supplier: f.text("supplier", { label: "Proveedor" }),
        amount: f.money("amount", { label: "Monto" }),
        change: f.number("change_pct", { label: "Variación", decimals: 1, suffix: "%" }),
    },
}))

export const subscriptionPaymentsViews = subscriptionPaymentsEntity.views({
    table: { columns: ["date", "supplier", "amount", "change"], primary: "date" },
})
