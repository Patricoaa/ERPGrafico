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
        cardPlacement: "metrics",
        get: (p) => parseFloat(p.total_haberes as unknown as string) || 0,
    },
    netSalary: {
        key: "net_salary",
        type: "currency",
        label: "Líquido",
        cardPlacement: "metrics",
        get: (p) => parseFloat(p.net_salary as unknown as string) || 0,
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
})
