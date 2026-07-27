import { createEntityFields } from "@/components/shared"
import { DataCell } from "@/components/shared"
import type { Employee } from "@/types/hr"

export const employeeFields = createEntityFields<Employee>()({
    displayId: {
        order: 10,
        key: "display_id",
        type: "code",
        label: "Código",
    },
    contact: {
        order: 15,
        key: "contact_detail",
        type: "computed",
        label: "Contacto",
        render: (e) => (
            <DataCell.ContactLink contactId={e.contact}>
                {e.contact_detail?.name}
            </DataCell.ContactLink>
        ),
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
        type: "computed",
        label: "Previsión",
        render: (e) => (
            <DataCell.Text>{e.afp_detail?.name || 'No disp.'}</DataCell.Text>
        ),
    },
    salud: {
        order: 50,
        key: "salud_type_display",
        type: "computed",
        label: "Salud",
        render: (e) => (
            <DataCell.Text>{e.salud_type_display || 'No disp.'}</DataCell.Text>
        ),
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
