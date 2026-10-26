import { defineEntity } from "@/components/entity-view"
import type { Payroll } from "@/types/hr"

/** Payroll list (ADR-0087 oleada B5). Replaces payrollFields.ts (0 computed, 9 ad-hoc get()). */
export const payrollEntity = defineEntity<Payroll>()((f) => ({
    label: "hr.payroll",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        employeeName: f.text((p) => p.employee_name, { label: "Empleado" }),
        period: f.text("period_label", { label: "Período", tone: "secondary" }),
        totalHaberes: f.money("total_haberes", { label: "Haberes" }),
        netSalary: f.money("net_salary", { label: "Líquido" }),
        legalDeductionsWorker: f.money((p) => p.legal_deductions_worker ?? "0", { label: "Desc. Legales" }),
        employerContribution: f.money((p) => p.employer_contribution ?? "0", { label: "Aporte Patr." }),
        otherDeductions: f.money((p) => p.other_deductions ?? "0", { label: "Otros Desc." }),
        advancesTotal: f.money((p) => p.advances_total ?? "0", { label: "Anticipos" }),
        status: f.status((p) => ({ status: p.status, label: p.status_display }), { label: "Estado" }),
        remunerationPaidStatus: f.status((p) => ({ status: p.remuneration_paid_status ?? "PENDING" }), { label: "Pago" }),
        previredPaidStatus: f.status((p) => ({ status: p.previred_paid_status ?? "PENDING" }), { label: "Previred" }),
    },
}))

export const payrollViews = payrollEntity.views({
    table: {
        columns: ["folio", "employeeName", "period", "totalHaberes", "netSalary", "legalDeductionsWorker", "employerContribution", "otherDeductions", "advancesTotal", "status", "remunerationPaidStatus", "previredPaidStatus"],
        primary: "folio",
    },
    card: {
        rail: { status: (r) => r.status },
        title: "employeeName",
        subtitle: ["folio", "period"],
        trailing: ["netSalary"],
        meta: ["status", "remunerationPaidStatus", "previredPaidStatus"],
    },
})
