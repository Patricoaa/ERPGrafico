import { defineEntity } from "@/components/entity-view"
import type { EmployeeMovement } from "@/types/hr"

/** Pago de remuneración, anticipo o préstamo con un empleado (ADR-0156). */
export const employeeMovementEntity = defineEntity<EmployeeMovement>()((f) => ({
    label: "hr.employeemovement",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        employee: f.text("employee_name", { label: "Empleado" }),
        kind: f.text("kind_display", { label: "Tipo" }),
        date: f.date("date", { label: "Fecha" }),
        amount: f.money("amount", { label: "Monto" }),
        balance: f.money("balance", { label: "Saldo" }),
        status: f.status((m) => ({ status: m.status, label: m.status_display }), { label: "Estado" }),
    },
}))

export const employeeMovementViews = employeeMovementEntity.views({
    table: { columns: ["folio", "employee", "kind", "date", "amount", "balance", "status"], defaultSort: "-date" },
    card: { rail: { status: (r) => r.status }, title: "employee", subtitle: ["folio", "kind", "date"], meta: ["balance"], trailing: ["status", "amount"] },
})
