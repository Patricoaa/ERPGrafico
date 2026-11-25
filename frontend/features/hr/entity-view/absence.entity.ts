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
    // ADR-0158 §3, client mode: the server filters by type and dates; the employee scope matches in the browser.
    query: {
        search: { placeholder: "Buscar ausencias…", scopes: [{ field: "employeeName", param: "employee_name", clientKey: "employee_name" }] },
        filters: {
            date: { field: "startDate", control: "date", paramFrom: "start_date_after", paramTo: "start_date_before" },
            absence_type: {
                field: "absenceTypeLabel",
                control: "single",
                options: [
                    { value: "AUSENTISMO", label: "Ausentismo" },
                    { value: "LICENCIA", label: "Licencia Médica" },
                    { value: "PERMISO_SIN_GOCE", label: "Permiso sin Goce" },
                    { value: "AUSENCIA_HORAS", label: "Ausencia de Horas" },
                ],
            },
        },
        sort: { fields: ["startDate", "employeeName", "absenceType", "endDate", "days"], default: "-startDate" },
        groupBy: { fields: ["absenceTypeLabel", "employeeName"] },
    },
}))

export const absenceViews = absenceEntity.views({
    table: { columns: ["employeeName", "absenceType", "startDate", "endDate", "days"], defaultSort: "-startDate" },
    card: { title: "employeeName", subtitle: ["startDate", "endDate"], meta: ["days"], trailing: ["absenceType"] },
})
