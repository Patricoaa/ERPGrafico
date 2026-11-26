"use client"

import { Collection, useEntityCollection, type CollectionQuery } from "@/components/entity-view"
import { budgetVarianceEntity, budgetVarianceViews } from "../entity-view/budgetVariance.entity"
import type { BudgetVarianceNode } from "../types"

export type { BudgetVarianceAccountType, BudgetVarianceNode } from "../types"

type VarianceQuery = CollectionQuery<keyof typeof budgetVarianceEntity.fields>

interface BudgetVarianceTableProps {
    data: BudgetVarianceNode[]
    loading?: boolean
    /** Barra canónica ADR-0158; ausente cuando la tabla se reutiliza sin controles de informe. */
    query?: VarianceQuery
    exportFilters?: Record<string, unknown>
    onResetFilters?: () => void
}

/**
 * Budget variance as an entity-view tree: top-level accounts are section rows, unbudgeted accounts
 * with activity carry the «Sin presupuesto» note and the attention tone.
 */
export function BudgetVarianceTable({ data, loading = false, query, exportFilters, onResetFilters }: BudgetVarianceTableProps) {
    const collection = useEntityCollection(budgetVarianceEntity, { rows: data, rowCount: data.length, isLoading: loading }, {
        pagination: { mode: "none" },
        // Top-level accounts (the roots in `data`) head their branch.
        rowTone: (node: BudgetVarianceNode) => (node.is_unbudgeted ? "attention" : data.includes(node) ? "section" : null),
    })
    return (
        <Collection.Root collection={collection} query={query} label="Variación presupuestal">
            {query && <Collection.Toolbar exportFilters={exportFilters} />}
            <Collection.View
                table={budgetVarianceViews.table}
                emptyTitle="Sin presupuesto para el período"
                emptyDescription="No hay cuentas con presupuesto o movimientos en el período seleccionado."
                onResetFilters={onResetFilters}
            />
        </Collection.Root>
    )
}

