import { createEntityFields } from "@/components/shared"
import type { Check } from "./types"
import { DataCell } from "@/components/shared"

export const checkFields = createEntityFields<Check>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
        order: 10,
    },
    checkNumber: {
        key: "check_number",
        type: "text",
        label: "# Cheque",
        order: 20,
    },
    dueDate: {
        key: "due_date",
        type: "date",
        label: "Vencimiento",
        order: 30,
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
        order: 40,
        get: (c) => parseFloat(c.amount) || 0,
        cellProps: { weight: "bold" },
    },
    saleOrder: {
        key: "sale_order_display",
        type: "computed",
        label: "NV Asociada",
        order: 50,
        render: (c) => {
            const so = c.sale_order_display
            if (!so) return null
            return (
                <div className="flex justify-center">
                    <DataCell.Entity entityLabel="sales.saleorder" number={so.number} />
                </div>
            )
        },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        order: 60,
    },
})
