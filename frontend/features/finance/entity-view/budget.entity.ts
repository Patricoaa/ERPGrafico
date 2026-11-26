import { defineEntity } from "@/components/entity-view"
import { thisYear } from "@/lib/date-presets"
import type { Budget } from "../hooks/useBudgets"

const currentYear = thisYear()

/**
 * Budgets list (ADR-0087 oleada B5 + ADR-0158). The canonical toolbar owns search, the date
 * filter and sorting; `BudgetViewSet` resolves them server-side (no `sorting: "client"`).
 */
export const budgetEntity = defineEntity<Budget>()((f) => ({
    label: "accounting.budget",
    fields: {
        name: f.text("name", { label: "Nombre", orderBy: "name" }),
        description: f.text("description", { label: "Descripción", tone: "secondary" }),
        period: f.dateRange((b) => ({ from: b.start_date, to: b.end_date }), { label: "Periodo" }),
        // Needed for the sort header labels; not added to the rendered views.
        startDate: f.date("start_date", { label: "Desde", orderBy: "start_date" }),
        endDate: f.date("end_date", { label: "Hasta", orderBy: "end_date" }),
    },
    query: {
        search: { placeholder: "Buscar presupuestos…" },
        filters: {
            period: {
                field: "period",
                control: "date",
                paramFrom: "start_date__gte",
                paramTo: "end_date__lte",
            },
        },
        sort: { fields: ["name", "startDate", "endDate"], default: "-startDate" },
        views: [
            { id: "all", label: "Todos" },
            { id: "this-year", label: "Este año", filters: { period: [currentYear.from, currentYear.to] } },
        ],
    },
}))

export const budgetViews = budgetEntity.views({
    table: { columns: ["name", "description", "period"], primary: "name" },
    card: {
        title: "name",
        subtitle: ["description"],
        trailing: ["period"],
    },
})
