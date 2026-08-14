import { createEntityFields } from "@/components/shared"
import type { Absence } from "@/types/hr"

export const absenceFields = createEntityFields<Absence>()({
    employeeName: {
        key: "employee_name",
        type: "text",
        label: "Empleado",
    },
    absenceType: {
        key: "absence_type",
        type: "chip-category",
        domain: "absence_type",
        label: "Tipo",
    },
    startDate: {
        key: "start_date",
        type: "date",
        label: "Inicio",
    },
    endDate: {
        key: "end_date",
        type: "date",
        label: "Fin",
    },
    days: {
        key: "days",
        type: "number",
        label: "Días",
    },
})
