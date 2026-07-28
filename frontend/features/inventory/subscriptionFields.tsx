import { createEntityFields } from "@/components/shared"
import type { Subscription } from "./hooks/useSubscriptions"
import { DataCell, Chip, StatusBadge } from "@/components/shared"

function getPaymentScheduleText(sub: Subscription) {
    if (sub.payment_day_type === "FIXED_DAY" && sub.payment_day) {
        return `Día ${sub.payment_day} de cada ${sub.recurrence_display.toLowerCase()}`
    } else if (sub.payment_day_type === "INTERVAL" && sub.payment_interval_days) {
        return `Cada ${sub.payment_interval_days} días`
    }
    return sub.recurrence_display
}

export const subscriptionFields = createEntityFields<Subscription>()({
    status: {
        key: "status",
        type: "computed",
        label: "Estado",
        render: (s) => (
            <div className="flex justify-center">
                <StatusBadge status={s.status} />
            </div>
        ),
    },
    categoryName: {
        key: "category_name",
        type: "secondary",
        label: "Categoría",
    },
    supplierName: {
        key: "supplier_name",
        type: "computed",
        label: "Proveedor",
        render: (s) => (
            <div className="flex justify-center w-full">
                <DataCell.ContactLink contactId={s.supplier_id}>
                    {s.supplier_name}
                </DataCell.ContactLink>
            </div>
        ),
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
    },
    nextPaymentDate: {
        key: "next_payment_date",
        type: "date",
        label: "Próximo Pago",
    },
    productName: {
        key: "product_name",
        type: "computed",
        label: "Producto",
        render: (sub) => (
            <div className="flex flex-col items-center gap-1 py-1 w-full">
                <DataCell.Text>{sub.product_name}</DataCell.Text>
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {sub.product_internal_code && (
                        <Chip size="xs" className="opacity-80">{sub.product_internal_code}</Chip>
                    )}
                    {sub.product_code && sub.product_code !== sub.product_internal_code && (
                        <Chip size="xs" intent="primary" className="opacity-80">{sub.product_code}</Chip>
                    )}
                </div>
            </div>
        ),
    },
    frequency: {
        key: "recurrence_display",
        type: "computed",
        label: "Frecuencia",
        render: (sub) => (
            <DataCell.Secondary>{getPaymentScheduleText(sub)}</DataCell.Secondary>
        ),
    },
})
