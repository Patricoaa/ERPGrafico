import { createEntityFields } from "@/components/shared"
import { DataCell } from "@/components/shared"
import type { SalaryAdvance } from "@/types/hr"

export const salaryAdvanceFields = createEntityFields<SalaryAdvance>()({
    employeeName: {
        key: "employee_name",
        type: "computed",
        label: "Empleado",
        render: (a) => (
            <div className="flex flex-col items-center justify-center w-full">
                <DataCell.Text weight="bold">{a.employee_name}</DataCell.Text>
                <DataCell.Secondary>{a.employee_display_id}</DataCell.Secondary>
            </div>
        ),
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
        intent: "warning",
        weight: "bold",
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
