import { defineEntity } from "@/components/entity-view"
import type { SubscriptionPayment } from "../analytics/operations.types"

/** Purchase-order payments of a recurring product with the change against the previous one (ADR-0148). */
export const operationsPaymentEntity = defineEntity<SubscriptionPayment>()((f) => ({
    title: "Pagos",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        supplier: f.text((p) => p.supplier ?? "", { label: "Proveedor" }),
        quantity: f.number("quantity", { label: "Cantidad", decimals: 2 }),
        unitCost: f.money("unit_cost", { label: "Monto" }),
        change: f.number("change_pct", { label: "Variación", decimals: 1, suffix: "%" }),
    },
}))

export const operationsPaymentViews = operationsPaymentEntity.views({
    table: { columns: ["date", "supplier", "quantity", "unitCost", "change"], primary: "date" },
})
