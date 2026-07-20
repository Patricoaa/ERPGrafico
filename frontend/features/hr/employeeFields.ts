import { createEntityFields } from "@/components/shared"
import type { Employee } from "@/types/hr"

export const employeeFields = createEntityFields<Employee>()({
    displayId: {
        order: 10,
        key: "display_id",
        type: "code",
        label: "Código",
    },
    position: {
        order: 20,
        key: "position",
        type: "text",
        label: "Cargo",
    },
    department: {
        order: 30,
        key: "department",
        type: "text",
        label: "Dpto.",
    },
    afp: {
        order: 40,
        key: "afp_detail",
        type: "text",
        label: "Previsión",
        get: (e) => `AFP: ${(e as unknown as Record<string, unknown>).afp_detail ? ((e as unknown as Record<string, unknown>).afp_detail as Record<string, unknown>).name ?? 'N/A' : 'N/A'}`,
    },
    salud: {
        order: 50,
        key: "salud_type_display",
        type: "text",
        label: "Salud",
    },
    baseSalary: {
        order: 60,
        key: "base_salary",
        type: "currency",
        label: "Sueldo Base",
        get: (e) => parseFloat((e.base_salary as string) || "0"),
    },
    status: {
        order: 70,
        key: "status",
        type: "status",
        label: "Estado",
        get: (e) => e.status,
        getLabel: (e) => (e as Employee & { status_display?: string }).status_display ?? e.status,
    },
}, {
    title: { field: 'contact_detail', template: '{contact_detail.name}' },
})
