import { createEntityFields } from "@/components/shared"
import type { Payroll } from "@/types/hr"

export const payrollFields = createEntityFields<Payroll>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Folio",
    },
    employeeName: {
        key: "employee_name",
        type: "text",
        label: "Empleado",
        get: (p) => (p as Payroll & Record<string, unknown>).employee_name as string || "",
    },
    periodLabel: {
        key: "period_label",
        type: "secondary",
        label: "Período",
    },
    totalHaberes: {
        key: "total_haberes",
        type: "currency",
        label: "Haberes",
        get: (p) => parseFloat(p.total_haberes as unknown as string) || 0,
    },
    netSalary: {
        key: "net_salary",
        type: "currency",
        label: "Líquido",
        get: (p) => parseFloat(p.net_salary as unknown as string) || 0,
    },
    legalDeductionsWorker: {
        key: "legal_deductions_worker",
        type: "currency",
        label: "Desc. Legales",
        get: (p) => parseFloat((p as Payroll & Record<string, string>).legal_deductions_worker || "0"),
    },
    employerContribution: {
        key: "employer_contribution",
        type: "currency",
        label: "Aporte Patr.",
        get: (p) => parseFloat((p as Payroll & Record<string, string>).employer_contribution || "0"),
    },
    otherDeductions: {
        key: "other_deductions",
        type: "currency",
        label: "Otros Desc.",
        get: (p) => parseFloat((p as Payroll & Record<string, string>).other_deductions || "0"),
    },
    advancesTotal: {
        key: "advances_total",
        type: "currency",
        label: "Anticipos",
        get: (p) => parseFloat((p as Payroll & Record<string, string>).advances_total || "0"),
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
    remunerationPaidStatus: {
        key: "remuneration_paid_status",
        type: "status",
        label: "Pago",
        get: (p) => p.remuneration_paid_status || "PENDING",
    },
    previredPaidStatus: {
        key: "previred_paid_status",
        type: "status",
        label: "Previred",
        get: (p) => (p as Payroll & Record<string, string>).previred_paid_status || "PENDING",
    },
})
