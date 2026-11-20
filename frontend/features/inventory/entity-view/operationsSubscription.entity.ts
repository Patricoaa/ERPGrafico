import { defineEntity } from "@/components/entity-view"
import type { SubscriptionFrequency, SubscriptionItem, SubscriptionStatus } from "../analytics/operations.types"

const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
    WEEKLY: "Semanal", MONTHLY: "Mensual", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual",
}
const STATUS_LABELS: Record<SubscriptionStatus, string> = {
    ACTIVE: "Activa", PAUSED: "Pausada", CANCELLED: "Cancelada", EXPIRED: "Vencida",
}

/** Subscriptions of a recurring product with their annualized cost and next payment (ADR-0148). */
export const operationsSubscriptionEntity = defineEntity<SubscriptionItem>()((f) => ({
    title: "Suscripciones",
    fields: {
        supplier: f.text("supplier", { label: "Proveedor" }),
        status: f.status(
            (s) => ({ status: s.status === "ACTIVE" ? "active" : "inactive", label: STATUS_LABELS[s.status] }),
            { label: "Estado" },
        ),
        frequency: f.text((s) => FREQUENCY_LABELS[s.frequency], { label: "Frecuencia" }),
        amount: f.money("amount", { label: "Monto" }),
        annualized: f.money("annualized", { label: "Anualizado" }),
        nextPayment: f.date("next_payment_date", { label: "Próximo pago" }),
        days: f.number("days_to_payment", { label: "Días al pago", decimals: 0 }),
    },
}))

export const operationsSubscriptionViews = operationsSubscriptionEntity.views({
    table: {
        columns: ["supplier", "status", "frequency", "amount", "annualized", "nextPayment", "days"],
        primary: "supplier",
    },
})
