import { createEntityFields } from "@/components/shared"
import type { SalaryAdvance } from "@/types/hr"

export const salaryAdvanceFields = createEntityFields<SalaryAdvance>()({
    employeeName: {
        key: "employee_name",
        type: "text",
        label: "Empleado",
    },
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    amount: {
        key: "amount",
        type: "currency",
        label: "Monto",
        get: (a) => parseFloat(a.amount as unknown as string) || 0,
        cellProps: { intent: "warning", weight: "bold" },
    },
    isDiscounted: {
        key: "is_discounted",
        type: "status",
        label: "Estado",
        get: (a) => a.is_discounted ? "DISCOUNTED" : "PENDING",
        getLabel: (a) => a.is_discounted ? "Descontado" : "Pendiente",
    },
    payrollDisplayId: {
        key: "payroll_display_id",
        type: "code",
        label: "Liquidación",
    },
})
