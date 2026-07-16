import { createEntityFields } from "@/components/shared"
import type { Subscription } from "./hooks/useSubscriptions"

export const subscriptionFields = createEntityFields<Subscription>()({
    categoryName: {
        key: "category_name",
        type: "secondary",
        label: "Categoría",
    },
    supplierName: {
        key: "supplier_name",
        type: "secondary",
        label: "Proveedor",
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
})
