import { createEntityFields } from "@/components/shared"
import type { Employee } from "@/types/hr"

export const employeeFields = createEntityFields<Employee>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Código",
    },
    baseSalary: {
        key: "base_salary",
        type: "currency",
        label: "Sueldo Base",
        get: (e) => parseFloat((e.base_salary as string) || "0"),
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        get: (e) => e.status,
    },
})
