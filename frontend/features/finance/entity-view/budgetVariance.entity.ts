import { defineEntity } from "@/components/entity-view"
import { useBudgetVarianceExport } from "../hooks/useBudgetVarianceExport"
import type { BudgetVarianceNode } from "../types"
import "./financialStatement.entity"

/**
 * Budget variance (ADR-0087): accounts as a tree with the month and year-to-date actual, budget and
 * variance. The variance colors by the account type (income up is good, expense up is bad) and uses
 * the server's percentage. Reuses the statement kinds (`statementAccount`, `statementVariance`).
 */
const directionOf = (n: BudgetVarianceNode) => (n.type === "INCOME" ? "higher-is-better" as const : "lower-is-better" as const)
const fixed = { sortable: false } as const

const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }))

export const budgetVarianceEntity = defineEntity<BudgetVarianceNode>()((f) => ({
    title: "Variación presupuestal",
    // ADR-0158: los parámetros del informe viven en la barra y en la URL, no en el estado local.
    query: {
        search: false,
        filters: {
            budget: { control: "single", label: "Presupuesto", options: "remote" },
            month: { control: "single", label: "Mes", options: MONTH_OPTIONS },
            // Los años salen de los presupuestos disponibles (los pasa la vista como filterOptions).
            year: { control: "single", label: "Año", options: "remote" },
        },
    },
    export: { formats: ["csv"], useExport: useBudgetVarianceExport },
    tree: { children: (n) => (n.children.length > 0 ? n.children : undefined) },
    fields: {
        account: f.value("statementAccount", (n) => ({ code: n.code, name: n.name, note: n.is_unbudgeted ? "Sin presupuesto" : undefined }), { ...fixed, label: "Cuenta contable" }),
        monthActual: f.money("month_actual", { ...fixed, label: "Real mes" }),
        monthBudget: f.money("month_budget", { ...fixed, label: "Ppto. mes" }),
        monthVariance: f.value("statementVariance", (n) => ({ balance: n.month_actual, comp: n.month_budget, direction: directionOf(n), percentage: n.month_percentage }), { ...fixed, label: "Var. mes" }),
        ytdActual: f.money("ytd_actual", { ...fixed, label: "Real año" }),
        ytdBudget: f.money("ytd_budget", { ...fixed, label: "Ppto. año" }),
        ytdVariance: f.value("statementVariance", (n) => ({ balance: n.ytd_actual, comp: n.ytd_budget, direction: directionOf(n), percentage: n.ytd_percentage }), { ...fixed, label: "Var. año" }),
    },
}))

export const budgetVarianceViews = budgetVarianceEntity.views({
    table: { columns: ["account", "monthActual", "monthBudget", "monthVariance", "ytdActual", "ytdBudget", "ytdVariance"], primary: "account" },
})
