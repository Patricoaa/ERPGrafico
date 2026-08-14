import { createEntityFields } from "@/components/shared"
import type { TerminalBatch } from "@/features/treasury/types"
import { DataCell } from "@/components/shared"
import { Building2 } from "lucide-react"
import { format } from "date-fns"

export const terminalBatchFields = createEntityFields<TerminalBatch>()({
    salesDate: {
        key: "sales_date",
        type: "computed",
        label: "Fecha Venta",
        render: (b) => (
            <div className="flex flex-col justify-center w-full items-center text-xs">
                <DataCell.Date value={b.sales_date} />
                {b.sales_date_end && b.sales_date_end !== b.sales_date && (
                    <span className="text-3xs text-muted-foreground leading-none mt-1">
                        al {format(new Date(b.sales_date_end + "T12:00:00"), "dd/MM/yyyy")}
                    </span>
                )}
            </div>
        ),
    },
    transactionCount: {
        key: "transaction_count",
        type: "number",
        label: "Transacciones",
    },
    providerName: {
        key: "provider_name",
        type: "computed",
        label: "Proveedor",
        render: (b) => (
            <div className="flex flex-col items-center">
                <span className="font-bold flex items-center justify-center gap-1.5 text-center w-full">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {b.provider_name}
                </span>
                <span className="text-3xs text-muted-foreground uppercase tracking-wide text-center">
                    {b.payment_method_name} (Depósito)
                </span>
            </div>
        ),
    },
    netAmount: {
        key: "net_amount",
        type: "currency",
        label: "Depósito Neto",
    },
    commissionTotal: {
        key: 'commission_total',
        type: 'currency',
        label: 'Comisión',
        get: (b) => (b.commission_total ? -Math.abs(parseFloat(b.commission_total)) : 0),
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        get: (b) => b.is_settled ? 'settled' : 'pending',
        getLabel: (b) => b.is_settled ? 'Liquidado' : 'Pendiente',
    },
})
