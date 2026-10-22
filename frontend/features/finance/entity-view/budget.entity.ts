import { defineEntity } from "@/components/entity-view"
import type { Budget } from "../hooks/useBudgets"

/**
 * Budgets list (ADR-0087 oleada B5). Replaces budgetFields.tsx (1 computed: a name field with an
 * internal Link to the detail page). `onOpen` now opens the same page (BudgetsClientView) —
 * the whole row, not just the name text — matching the existing "Ver Ejecución" action's target.
 */
export const budgetEntity = defineEntity<Budget>()((f) => ({
    label: "accounting.budget",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        description: f.text("description", { label: "Descripción", tone: "secondary" }),
        period: f.dateRange((b) => ({ from: b.start_date, to: b.end_date }), { label: "Periodo" }),
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
