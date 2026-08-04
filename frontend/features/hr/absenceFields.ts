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
        type: "status",
        label: "Tipo",
        get: (a) => a.absence_type,
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
        type: "code",
        label: "Días",
    },
})
