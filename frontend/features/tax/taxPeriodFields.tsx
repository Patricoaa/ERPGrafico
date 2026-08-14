import { createEntityFields, DataCell } from "@/components/shared"
import type { TaxPeriod } from "./types"

export const taxPeriodFields = createEntityFields<TaxPeriod>()({
    period_display: {
        key: "period_display",
        type: "computed",
        label: "Período",
        fieldRole: "identifier",
        tableOptions: {
            align: "center",
            sortingFn: (rowA, rowB) => {
                if (rowA.original.year !== rowB.original.year) {
                    return rowA.original.year - rowB.original.year
                }
                return rowA.original.month - rowB.original.month
            },
        },
        render: (e) => (
            <div className="flex items-center justify-center gap-3 w-full">
                <div className="w-10 h-10 rounded-sm bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                    <span className="text-4xs font-bold text-primary/60">{e.year}</span>
                    <span className="text-xs font-bold text-primary">{e.month_display?.substring(0, 3)}</span>
                </div>
                <div>
                    <span className="font-medium">{e.month_display || ''} {e.year}</span>
                </div>
            </div>
        ),
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        tableOptions: {
            filterFn: (row, id, value) => (value as string[]).includes(row.original.status),
        },
    },
    vat_to_pay: {
        key: "vat_to_pay",
        type: "currency",
        label: "Impuesto Determinado",
        className: "font-mono",
        tableOptions: {
            align: "center",
            accessorFn: (row) => row.declaration_summary?.vat_to_pay || 0,
        },
    },
    payment_status: {
        key: "payment_status",
        type: "computed",
        label: "Estado Pago",
        fieldRole: "primary-value",
        render: (e) => {
            const summary = e.declaration_summary
            return (
                <div className="flex justify-center w-full">
                    {!summary ? (
                        <span className="text-muted-foreground">-</span>
                    ) : summary.is_fully_paid ? (
                        <DataCell.Status status="PAID" label="Pagado" size="sm" />
                    ) : summary.vat_to_pay > 0 && e.status === 'CLOSED' ? (
                        <DataCell.Status status="VOIDED" label="Pendiente" size="sm" />
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </div>
            )
        },
    },
}, { title: { field: 'month_display', template: '{month_display} {year}' } })
