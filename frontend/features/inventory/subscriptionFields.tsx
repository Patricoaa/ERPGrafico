import { createEntityFields } from "@/components/shared"
import { DataCell } from "@/components/shared"
import type { Subscription } from "./hooks/useSubscriptions"

function getPaymentScheduleText(sub: Subscription) {
    if (sub.payment_day_type === "FIXED_DAY" && sub.payment_day) {
        return `Día ${sub.payment_day} de cada ${sub.recurrence_display.toLowerCase()}`
    } else if (sub.payment_day_type === "INTERVAL" && sub.payment_interval_days) {
        return `Cada ${sub.payment_interval_days} días`
    }
    return sub.recurrence_display
}

export const subscriptionFields = createEntityFields<Subscription>()({
    productName: {
        key: "product_name",
        type: "text",
        label: "Producto",
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        tableOptions: { width: 100 },
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
    },
    supplierName: {
        key: "supplier_name",
        type: "computed",
        fieldRole: "relation",
        label: "Proveedor",
        render: (s) => (
            <DataCell.ContactLink contactId={s.supplier_id}>
                {s.supplier_name}
            </DataCell.ContactLink>
        ),
    },
    nextPaymentDate: {
        key: "next_payment_date",
        type: "date",
        label: "Próximo Pago",
    },
    frequency: {
        key: "recurrence_display",
        type: "secondary",
        label: "Frecuencia",
        get: (sub) => getPaymentScheduleText(sub),
    },
})
