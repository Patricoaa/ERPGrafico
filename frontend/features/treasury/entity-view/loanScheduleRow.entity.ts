import { defineEntity } from "@/components/entity-view"

export interface LoanScheduleRow {
    number: number
    due_date: string
    principal_amount: string
    interest_amount: string
    insurance_amount: string
    total_amount: string
    outstanding_balance: string
}

const fixed = { sortable: false } as const

export const loanScheduleRowEntity = defineEntity<LoanScheduleRow>()((f) => ({
    title: "Tabla de Amortización",
    fields: {
        number: f.code((r) => r.number, { ...fixed, label: "#" }),
        dueDate: f.date((r) => r.due_date, { ...fixed, label: "Vencimiento" }),
        principal: f.money((r) => Number(r.principal_amount), { ...fixed, label: "Capital" }),
        interest: f.money((r) => Number(r.interest_amount), { ...fixed, label: "Interés" }),
        insurance: f.money((r) => Number(r.insurance_amount), { ...fixed, label: "Seguro" }),
        total: f.money((r) => Number(r.total_amount), { ...fixed, label: "Total" }),
        balance: f.money((r) => Number(r.outstanding_balance), { ...fixed, label: "Saldo" }),
    },
}))

export const loanScheduleRowViews = loanScheduleRowEntity.views({
    table: { columns: ["number", "dueDate", "principal", "interest", "insurance", "total", "balance"] },
})
