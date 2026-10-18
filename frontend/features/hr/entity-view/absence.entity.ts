import { defineEntity } from "@/components/entity-view"
import type { Absence } from "@/types/hr"

/** Absence (ADR-0087 oleada A2). Replaces absenceFields.ts + renderCard. */
export const absenceEntity = defineEntity<Absence>()((f) => ({
    label: "hr.absence",
    fields: {
        employeeName: f.text("employee_name", { label: "Empleado" }),
        absenceType: f.tags((a) => [a.absence_type], { label: "Tipo", domain: "absence_type" }),
        startDate: f.date("start_date", { label: "Inicio" }),
        endDate: f.date("end_date", { label: "Fin" }),
        days: f.number("days", { label: "Días" }),
        // Grouping dimension only: groups read the readable type, not the enum code.
        absenceTypeLabel: f.text("absence_type_display", { label: "Tipo ausencia" }),
    },
}))

export const absenceViews = absenceEntity.views({
    table: { columns: ["employeeName", "absenceType", "startDate", "endDate", "days"], defaultSort: "-startDate" },
    card: { title: "employeeName", subtitle: ["startDate", "endDate"], meta: ["days"], trailing: ["absenceType"] },
})
