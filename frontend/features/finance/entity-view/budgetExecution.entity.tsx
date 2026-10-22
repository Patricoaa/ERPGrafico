"use client"

import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"

interface BudgetAccount { name: string; code: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        budgetAccount: { value: BudgetAccount; options: Record<never, never> }
    }
}

function BudgetAccountCell({ value }: ValueRenderProps<"budgetAccount">) {
    return (
        <div>
            <DataCell.Text>{value.name}</DataCell.Text>
            <DataCell.Secondary>{value.code}</DataCell.Secondary>
        </div>
    )
}

registerValueKind("budgetAccount", {
    format: (v) => v.name,
    render: BudgetAccountCell,
})

export interface BudgetExecutionItem {
    account_name: string
    account_code: string
    budgeted: number
    actual: number
    percentage: number
}

export const budgetExecutionEntity = defineEntity<BudgetExecutionItem>()((f) => ({
    title: "Ejecución presupuestaria",
    rowId: (r) => r.account_code,
    fields: {
        account: f.value("budgetAccount", (r) => ({ name: r.account_name, code: r.account_code }), { sortable: false, label: "Cuenta" }),
        budgeted: f.money("budgeted", { sortable: false, label: "Presupuesto" }),
        actual: f.money("actual", { sortable: false, label: "Real" }),
        ejecucion: f.progress((r) => ({ done: r.percentage, total: 100 }), { sortable: false, label: "Ejecución", format: "percent" }),
    },
}))

export const budgetExecutionViews = budgetExecutionEntity.views({
    table: { columns: ["account", "budgeted", "actual", "ejecucion"] },
})
