import { createEntityFields } from "@/components/shared"
import type { Employee } from "@/types/hr"

export const employeeFields = createEntityFields<Employee>()({
    displayId: {
        key: "display_id",
        type: "code",
        label: "Código",
    },
    contact: {
        key: "contact",
        type: "contact",
        label: "Contacto",
        get: (e) => e.contact,
        getDisplay: (e) => e.contact_detail?.name ?? "—",
    },
    position: {
        key: "position",
        type: "secondary",
        label: "Cargo",
    },
    department: {
        key: "department",
        type: "secondary",
        label: "Dpto.",
    },
    afp: {
        key: "afp_detail",
        type: "secondary",
        label: "Previsión",
        get: (e) => e.afp_detail?.name || 'No disp.',
    },
    salud: {
        key: "salud_type_display",
        type: "secondary",
        label: "Salud",
        get: (e) => e.salud_type_display || 'No disp.',
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
        getLabel: (e) => (e as Employee & { status_display?: string }).status_display ?? e.status,
    },
}, {
    title: { field: 'contact_detail', template: '{contact_detail.name}' },
})
