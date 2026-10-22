"use client"

import React, { useMemo } from "react"
import { financeApi } from "../api/financeApi"
import { Download, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader, MoneyDisplay, SkeletonShell, StatCard, StaleDataBanner } from "@/components/shared"
import type { KpiCardDef } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { useBudgetDetailData } from "../hooks/useBudgets"
import { budgetExecutionEntity, budgetExecutionViews, type BudgetExecutionItem } from "../entity-view/budgetExecution.entity"
import { toast } from "sonner"
import Link from "next/link"

interface BudgetDetailViewProps {
    budgetId: string
}

interface BudgetExecutionData {
    summary: {
        total_budgeted: number;
        total_actual: number;
        total_variance: number;
    };
    items: BudgetExecutionItem[];
}

interface Budget {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
}

const SKELETON_BUDGET: Budget = {
    id: 0,
    name: '——————————————————',
    start_date: '——————',
    end_date: '——————',
}

const SKELETON_EXECUTION: BudgetExecutionData = {
    summary: { total_budgeted: 0, total_actual: 0, total_variance: 0 },
    items: Array.from({ length: 6 }, () => ({
        account_name: '——————————————————',
        account_code: '————',
        budgeted: 0,
        actual: 0,
        percentage: 0,
    })),
}

export function BudgetDetailView({ budgetId }: BudgetDetailViewProps) {
    const { data, isLoading, isError } = useBudgetDetailData(budgetId ? Number(budgetId) : null)

    const budget = (data?.budget as Budget) ?? null
    const executionData = (data?.execution as BudgetExecutionData) ?? null

    const handleExport = async () => {
        if (!budget) return
        try {
            const blob = await financeApi.exportBudgetCsv(budget.id) as BlobPart
            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `ejecucion_${budget.name}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            toast.success("Exportación iniciada")
        } catch (err) {
            console.error(err)
            toast.error("Error al exportar CSV")
        }
    }

    const resolvedBudget = budget ?? SKELETON_BUDGET
    const resolvedExecution = executionData ?? SKELETON_EXECUTION
    const collection = useEntityCollection(budgetExecutionEntity, { rows: resolvedExecution.items }, { pagination: { mode: "none" } })

    const kpiCards = useMemo<KpiCardDef[]>(() => [
        {
            label: "Presupuestado",
            value: <MoneyDisplay amount={resolvedExecution.summary.total_budgeted} />,
            accent: "muted",
        },
        {
            label: "Ejecutado",
            value: <MoneyDisplay amount={resolvedExecution.summary.total_actual} />,
            accent: "muted",
        },
        {
            label: "Desviación",
            value: <MoneyDisplay amount={resolvedExecution.summary.total_variance} />,
            accent: "muted",
        },
    ], [resolvedExecution])

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando detalles del presupuesto">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/finances/budgets">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Link>
                    </Button>
                </div>

                <PageHeader
                    title={`Ejecución: ${resolvedBudget.name}`}
                    description={`${resolvedBudget.start_date} - ${resolvedBudget.end_date}`}
                    titleActions={
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar CSV
                        </Button>
                    }
                />

                <div className="grid gap-4 md:grid-cols-4">
                    {kpiCards.map((card, i) => (
                        <StatCard key={i} {...card} loading={isLoading} />
                    ))}
                </div>
                <Collection.Root collection={collection} label="Ejecución presupuestaria">
                    <Collection.View table={budgetExecutionViews.table} emptyTitle="Sin datos" emptyDescription="No se encontraron cuentas presupuestarias" />
                </Collection.Root>
            </div>
        </SkeletonShell>
    )
}
