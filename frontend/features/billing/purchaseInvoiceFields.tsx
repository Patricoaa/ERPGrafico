import { createEntityFields } from "@/components/shared"
import type { Invoice } from "./types"

export const purchaseInvoiceFields = createEntityFields<Invoice>()({
    displayId: {
        order: 10,
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    issueDate: {
        order: 20,
        key: "date",
        type: "date",
        label: "Fecha Emisión",
    },
    dueDate: {
        order: 30,
        key: "due_date",
        type: "date",
        label: "Vencimiento",
    },
    contactDisplayName: {
        order: 40,
        key: "partner_name",
        type: "text",
        label: "Proveedor",
    },
    dteType: {
        order: 45,
        key: "dte_type_display",
        type: "chip",
        label: "Tipo DTE",
    },
    totalWithTax: {
        order: 50,
        key: "total",
        type: "currency",
        label: "Total",
        cellProps: { intent: "success" },
    },
    totalWithTaxLocal: {
        order: 60,
        key: "total",
        type: "currency",
        label: "Total (Local)",
    },
    paymentStatus: {
        order: 65,
        key: "payment_status",
        type: "computed",
        label: "Pagado",
        render: (inv) => {
            const total = parseFloat(String((inv as Invoice).total ?? 0))
            const pending = (inv as Invoice).pending_amount ?? total
            const paid = total - pending
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0
            return (
                <div className="space-y-1 w-32">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span>{pct}%</span>
                        <span className="text-muted-foreground">${Math.round(paid).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )
        },
    },
    status: {
        order: 70,
        key: "status",
        type: "status",
        label: "Estado",
    },
}, {
    title: { field: 'partner_name', template: '{partner_name|reference}' },
})
