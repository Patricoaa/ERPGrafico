import { defineEntity } from "@/components/entity-view"
import type { BudgetVarianceNode } from "../types"
import "./financialStatement.entity"

/**
 * Budget variance (ADR-0087): accounts as a tree with the month and year-to-date actual, budget and
 * variance. The variance colors by the account type (income up is good, expense up is bad) and uses
 * the server's percentage. Reuses the statement kinds (`statementAccount`, `statementVariance`).
 */
const directionOf = (n: BudgetVarianceNode) => (n.type === "INCOME" ? "higher-is-better" as const : "lower-is-better" as const)
const fixed = { sortable: false } as const

export const budgetVarianceEntity = defineEntity<BudgetVarianceNode>()((f) => ({
    title: "Variación presupuestal",
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
