import { createEntityFields } from "@/components/shared"
import type { Check } from "./types"
import { DocumentRefLink } from "@/features/documents"

export const checkFields = createEntityFields<Check>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    checkNumber: {
        key: "check_number",
        type: "text",
        label: "# Cheque",
    },
    dueDate: {
        key: "due_date",
        type: "date",
        label: "Vencimiento",
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
        get: (c) => parseFloat(c.amount) || 0,
        weight: "bold",
    },
    saleOrder: {
        key: "sale_order_display",
        type: "computed",
        label: "OV Asociada",
        render: (c) => {
            if (!c.sale_order_document) return null
            return (
                <div className="flex justify-center">
                    <DocumentRefLink documentRef={c.sale_order_document} />
                </div>
            )
        },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
})
