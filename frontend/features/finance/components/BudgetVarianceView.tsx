"use client"

import React, { useEffect, useMemo, useRef } from 'react';

import { useCollectionQuery } from '@/components/entity-view';
import { PageHeader } from '@/components/shared';
import { useServerDate } from '@/hooks/useServerDate';

import { budgetVarianceEntity } from "../entity-view/budgetVariance.entity";
import { useAllBudgets, useBudgetVariance } from "../hooks/useBudgets";
import { BudgetVarianceTable, type BudgetVarianceNode } from "./BudgetVarianceTable";

/**
 * Versus presupuestario (ADR-0158): presupuesto, mes y año son estado de la URL gestionado por
 * `useCollectionQuery`; la barra de la colección los muestra y el hook de variación recibe el periodo.
 */
export function BudgetVarianceView() {
    const { month: serverMonth, year: serverYear } = useServerDate()
    const { budgets } = useAllBudgets()

    const filterOptions = useMemo(() => {
        const years = new Set<number>()
        for (const budget of budgets) {
            const from = Number(budget.start_date?.slice(0, 4))
            const to = Number(budget.end_date?.slice(0, 4))
            if (Number.isFinite(from)) years.add(from)
            if (Number.isFinite(to)) years.add(to)
        }
        return {
            budget: budgets.map((b) => ({ value: String(b.id), label: b.name })),
            year: [...years].sort((a, b) => a - b).map((y) => ({ value: String(y), label: String(y) })),
        }
    }, [budgets])

    const query = useCollectionQuery(budgetVarianceEntity, { filterOptions })
    const params = query.search.paramValues
    const budgetId = Number(params.budget ?? 0)
    const month = Number(params.month ?? serverMonth ?? new Date().getMonth() + 1)
    const year = Number(params.year ?? serverYear ?? new Date().getFullYear())

    // Selección inicial: se escribe en la URL una sola vez, nunca durante el render.
    const defaultSelected = useRef(false)
    useEffect(() => {
        if (defaultSelected.current || params.budget || budgets.length === 0) return
        defaultSelected.current = true
        void query.search.applyMany({ budget: String(budgets[0].id) })
    }, [params.budget, budgets, query.search])

    const { data, isLoading } = useBudgetVariance(
        budgetId || null,
        { month: String(month), year: String(year) },
    )
    const varianceData = useMemo<BudgetVarianceNode[]>(
        () => (Array.isArray(data) ? data as BudgetVarianceNode[] : []),
        [data],
    )

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-6">
            <div className="shrink-0">
                <PageHeader
                    title="Versus Presupuestario"
                    description="Análisis de ejecución mensual y acumulada contra el presupuesto."
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                <BudgetVarianceTable
                    data={varianceData}
                    loading={isLoading}
                    query={query}
                    exportFilters={{ budget: budgetId, month: String(month), year: String(year) }}
                    onResetFilters={query.search.clearAll}
                />
            </div>
        </div>
    );
}
