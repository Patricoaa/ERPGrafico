import { defineEntity } from "@/components/entity-view"
import type { LoanInstallment } from "../loans/types"

export interface LoanInstallmentRow extends LoanInstallment {
    /** Injected only on the synthetic fee row (number === 0). */
    _feeTotal?: number
}

const fixed = { sortable: false } as const

export const loanInstallmentEntity = defineEntity<LoanInstallmentRow>()((f) => ({
    title: "Tabla de amortización",
    rowId: (r) => String(r.id),
    fields: {
        num: f.number("number", { ...fixed, label: "#" }),
        dueDate: f.date("due_date", { ...fixed, label: "Vencimiento" }),
        principal: f.money("principal_amount", { ...fixed, label: "Capital" }),
        interest: f.money("interest_amount", { ...fixed, label: "Interés" }),
        others: f.money(
            (r) => r.number === 0
                ? String(r._feeTotal ?? 0)
                : String(parseFloat(r.insurance_amount) + parseFloat(r.penalty_paid)),
            { ...fixed, label: "Otros" }
        ),
        total: f.money("total_amount", { ...fixed, label: "Total" }),
        balance: f.money("outstanding_balance", { ...fixed, label: "Saldo" }),
        status: f.status(
            (r) => ({ status: r.status, label: r.status_display }),
            { ...fixed, label: "Estado" }
        ),
    },
}))

export const loanInstallmentViews = loanInstallmentEntity.views({
    table: { columns: ["num", "dueDate", "principal", "interest", "others", "total", "balance", "status"] },
})
