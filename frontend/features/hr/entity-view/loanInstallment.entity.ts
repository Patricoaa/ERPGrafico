import { defineEntity } from "@/components/entity-view"
import type { LoanInstallment } from "@/types/hr"

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

/** Fila del plan de cuotas: la vista previa no trae `id` ni `status`, por eso son opcionales. */
export type LoanScheduleRow = Pick<LoanInstallment, "number" | "year" | "month" | "principal" | "interest" | "amount"> & Partial<Pick<LoanInstallment, "status">>

const STATUS_LABEL: Record<LoanInstallment["status"], string> = { APPLIED: "Descontada", PENDING: "Pendiente" }

/** Plan de cuotas de un préstamo (ADR-0156): colección embebida sin ficha propia. */
export const loanInstallmentEntity = defineEntity<LoanScheduleRow>()((f) => ({
    title: "Plan de cuotas",
    rowId: (r) => r.number,
    fields: {
        number: f.number("number", { label: "#", sortable: false }),
        period: f.text((r) => `${MONTHS[r.month - 1]} ${r.year}`, { label: "Período", sortable: false }),
        principal: f.money("principal", { label: "Capital", sortable: false }),
        interest: f.money("interest", { label: "Interés", sortable: false }),
        amount: f.money("amount", { label: "Cuota", sortable: false }),
        status: f.text((r) => (r.status ? STATUS_LABEL[r.status] : ""), { label: "Estado", tone: "secondary", sortable: false }),
    },
}))

export const loanInstallmentViews = loanInstallmentEntity.views({
    table: { columns: ["number", "period", "principal", "interest", "amount", "status"] },
})
