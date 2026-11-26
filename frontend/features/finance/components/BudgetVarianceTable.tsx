"use client"

import { Collection, useEntityCollection } from "@/components/entity-view"
import { budgetVarianceEntity, budgetVarianceViews } from "../entity-view/budgetVariance.entity"
import type { BudgetVarianceNode } from "../types"

export type { BudgetVarianceAccountType, BudgetVarianceNode } from "../types"

interface BudgetVarianceTableProps {
    data: BudgetVarianceNode[]
    loading?: boolean
}

/**
 * Budget variance as an entity-view tree: top-level accounts are section rows, unbudgeted accounts
 * with activity carry the «Sin presupuesto» note and the attention tone.
 */
export function BudgetVarianceTable({ data, loading = false }: BudgetVarianceTableProps) {
    const collection = useEntityCollection(budgetVarianceEntity, { rows: data, rowCount: data.length, isLoading: loading }, {
        pagination: { mode: "none" },
        // Top-level accounts (the roots in `data`) head their branch.
        rowTone: (node: BudgetVarianceNode) => (node.is_unbudgeted ? "attention" : data.includes(node) ? "section" : null),
    })
    return (
        <Collection.Root collection={collection} label="Variación presupuestal">
            <Collection.View
                table={budgetVarianceViews.table}
                emptyTitle="Sin presupuesto para el período"
                emptyDescription="No hay cuentas con presupuesto o movimientos en el período seleccionado."
            />
        </Collection.Root>
    )
}

