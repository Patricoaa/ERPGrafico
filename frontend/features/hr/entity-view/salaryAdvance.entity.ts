import { defineEntity } from "@/components/entity-view"
import type { SalaryAdvance } from "@/types/hr"

/** Salary advance (ADR-0087 oleada A2). Replaces salaryAdvanceFields.tsx (1 computed) + renderCard. */
export const salaryAdvanceEntity = defineEntity<SalaryAdvance>()((f) => ({
    label: "hr.salaryadvance",
    fields: {
        employee: f.text("employee_name", { label: "Empleado" }),
        employeeCode: f.code("employee_display_id", { label: "Cód. empleado" }),
        date: f.date("date", { label: "Fecha" }),
        amount: f.money("amount", { label: "Monto" }),
        status: f.status((a) => ({ status: a.status, label: a.status_display }), { label: "Estado" }),
        payroll: f.code("payroll_display_id", { label: "Liquidación" }),
    },
}))

export const salaryAdvanceViews = salaryAdvanceEntity.views({
    table: { columns: ["employee", "employeeCode", "date", "amount", "status", "payroll"], defaultSort: "-date" },
    card: { title: "employee", subtitle: ["employeeCode", "date"], meta: ["payroll"], trailing: ["status", "amount"] },
})
