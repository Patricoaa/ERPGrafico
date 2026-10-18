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
        status: f.status((e) => ({ status: e.status, label: e.status_display || e.status }), { label: "Estado" }),
        // Grouping dimension only (search "Tipo contrato"); not a column.
        contractType: f.text("contract_type_display", { label: "Tipo contrato" }),
    },
}))

export const employeeViews = employeeEntity.views({
    table: { columns: ["displayId", "contact", "position", "department", "afp", "salud", "baseSalary", "status"] },
    card: { title: "name", subtitle: ["displayId", "position"], meta: ["department", "baseSalary"], trailing: ["status"] },
})
