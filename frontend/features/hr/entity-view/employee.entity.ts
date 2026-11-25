import { defineEntity } from "@/components/entity-view"
import type { Employee } from "@/types/hr"

/** Employee (ADR-0087 oleada A2). Replaces employeeFields.tsx + renderCard. */
export const employeeEntity = defineEntity<Employee>()((f) => ({
    label: "hr.employee",
    fields: {
        displayId: f.code("display_id", { label: "Código" }),
        name: f.text((e) => e.contact_detail?.name ?? null, { label: "Nombre" }),
        contact: f.contact((e) => (e.contact_detail ? { id: e.contact, name: e.contact_detail.name } : null), { label: "Contacto" }),
        position: f.text("position", { label: "Cargo", tone: "secondary" }),
        department: f.text("department", { label: "Dpto.", tone: "secondary" }),
        afp: f.text((e) => e.afp_detail?.name || "No disp.", { label: "Previsión", tone: "secondary" }),
        salud: f.text((e) => e.salud_type_display || "No disp.", { label: "Salud", tone: "secondary" }),
        baseSalary: f.money("base_salary", { label: "Sueldo Base" }),
        isActive: f.status((e) => (e.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
        // Grouping dimension only (search "Tipo contrato"); not a column.
        contractType: f.text("contract_type_display", { label: "Tipo contrato" }),
    },
    // ADR-0158 §3, client mode: the server filters, the browser sorts.
    query: {
        search: { placeholder: "Buscar por nombre o RUT…" },
        filters: { is_active: { field: "isActive", control: "single", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Archivado" }] } },
        sort: { fields: ["name", "displayId", "position", "department", "afp", "salud", "baseSalary", "isActive", "contractType"], default: "name" },
        groupBy: { fields: ["isActive", "contractType", "department"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "active", label: "Activos", filters: { is_active: "true" } },
        ],
    },
}))

export const employeeViews = employeeEntity.views({
    table: { columns: ["displayId", "contact", "position", "department", "afp", "salud", "baseSalary", "isActive"] },
    card: { title: "name", subtitle: ["displayId", "position"], meta: ["department", "baseSalary"], trailing: ["isActive"], muted: (e) => !e.is_active },
})
