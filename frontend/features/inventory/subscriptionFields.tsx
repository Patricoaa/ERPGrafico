import { createEntityFields } from "@/components/shared"
import { DataCell, Chip } from "@/components/shared"
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
    folio: {
        key: "id",
        type: "computed",
        fieldRole: "identifier",
        label: "Folio",
        render: (s) => <DataCell.Code>{`SUB-${s.id}`}</DataCell.Code>,
    },
    productName: {
        key: "product_name",
        type: "computed",
        fieldRole: "identifier",
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
    categoryName: {
        key: "category_name",
        type: "secondary",
        label: "Categoría",
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
