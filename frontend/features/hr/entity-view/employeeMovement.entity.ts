import { defineEntity } from "@/components/entity-view"
import type { EmployeeMovement } from "@/types/hr"
import { employeeMovementStatus, EMPLOYEE_MOVEMENT_STATUS_OPTIONS } from "../employeeMovementStatus"

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
        status: f.status((m) => employeeMovementStatus(m.status, m.status_display), { label: "Estado" }),
    },
    // ADR-0158 §3, client mode: the server filters by kind, status and dates; the employee scope matches in the browser.
    query: {
        search: { placeholder: "Buscar movimientos…", scopes: [{ field: "employee", param: "employee_name", clientKey: "employee_name" }] },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            kind: { field: "kind", control: "single", options: [{ value: "PAYMENT", label: "Pago de remuneración" }, { value: "ADVANCE", label: "Anticipo" }, { value: "LOAN", label: "Préstamo" }] },
            status: { field: "status", control: "single", options: EMPLOYEE_MOVEMENT_STATUS_OPTIONS },
        },
        sort: { fields: ["date", "folio", "employee", "kind", "amount", "balance", "status"], default: "-date" },
        groupBy: { fields: ["kind", "status", "employee"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "payment", label: "Pagos", filters: { kind: "PAYMENT" } },
            { id: "advance", label: "Anticipos", filters: { kind: "ADVANCE" } },
            { id: "loan", label: "Préstamos", filters: { kind: "LOAN" } },
        ],
    },
}))

export const employeeMovementViews = employeeMovementEntity.views({
    table: { columns: ["folio", "employee", "kind", "date", "amount", "balance", "status"], defaultSort: "-date" },
    card: { rail: { status: (r) => r.status }, title: "employee", subtitle: ["folio", "kind", "date"], meta: ["balance"], trailing: ["status", "amount"] },
})
