import { defineEntity } from "@/components/entity-view"
import type { Subscription } from "../hooks/useSubscriptions"

function paymentSchedule(sub: Subscription): string {
    if (sub.payment_day_type === "FIXED_DAY" && sub.payment_day) {
        return `Día ${sub.payment_day} de cada ${sub.recurrence_display.toLowerCase()}`
    }
    if (sub.payment_day_type === "INTERVAL" && sub.payment_interval_days) {
        return `Cada ${sub.payment_interval_days} días`
    }
    return sub.recurrence_display
}

/** Subscription (ADR-0087 oleada A2). Replaces subscriptionFields.tsx + the select column + renderCard. */
export const subscriptionEntity = defineEntity<Subscription>()((f) => ({
    label: "inventory.subscription",
    fields: {
        productName: f.text("product_name", { label: "Producto" }),
        status: f.status((s) => ({ status: s.status, label: s.status_display }), { label: "Estado" }),
        amount: f.money("amount", { label: "Monto" }),
        supplier: f.contact((s) => ({ id: s.supplier_id, name: s.supplier_name }), { label: "Proveedor" }),
        nextPaymentDate: f.date("next_payment_date", { label: "Próximo Pago" }),
        frequency: f.text(paymentSchedule, { label: "Frecuencia", tone: "secondary" }),
        // Grouping dimension only (search "Período"); the column shows the full schedule.
        period: f.text("recurrence_display", { label: "Período" }),
    },
}))

export const subscriptionViews = subscriptionEntity.views({
    table: { columns: ["productName", "status", "amount", "supplier", "nextPaymentDate", "frequency"] },
    card: { rail: { status: (r) => r.status }, title: "productName", subtitle: ["supplier", "frequency"], meta: ["nextPaymentDate"], trailing: ["status", "amount"] },
})
