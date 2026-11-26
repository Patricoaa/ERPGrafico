"use client"

import React from "react"
import { Download, Wallet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { BaseModal, Metric, MetricStrip, SkeletonShell, StaleDataBanner } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"

import { financeApi } from "../api/financeApi"
import { budgetExecutionEntity, budgetExecutionViews, type BudgetExecutionItem } from "../entity-view/budgetExecution.entity"
import { useBudgetDetailData, type Budget } from "../hooks/useBudgets"

interface BudgetExecutionPanelProps {
    /** Registro resuelto por `useSelectedEntity`; evita repetir el GET del presupuesto (ADR-0152). */
    budget: Budget | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface BudgetExecutionData {
    summary: {
        total_budgeted: number
        total_actual: number
        total_variance: number
    }
    items: BudgetExecutionItem[]
}

const SKELETON_BUDGET: Budget = {
    id: 0,
    name: "——————————————————",
    start_date: "——————",
    end_date: "——————",
}

const SKELETON_EXECUTION: BudgetExecutionData = {
    summary: { total_budgeted: 0, total_actual: 0, total_variance: 0 },
    items: Array.from({ length: 6 }, () => ({
        account_name: "——————————————————",
        account_code: "————",
        budgeted: 0,
        actual: 0,
        percentage: 0,
    })),
}

/** Panel `variant="execution"` de ADR-0152: una acción sobre el registro, no su ficha de edición. */
export function BudgetExecutionPanel({ budget, open, onOpenChange }: BudgetExecutionPanelProps) {
    const { data, isLoading, isError } = useBudgetDetailData(budget?.id ?? null, budget)

    const resolvedBudget = (data?.budget as Budget) ?? budget ?? SKELETON_BUDGET
    const executionData = (data?.execution as BudgetExecutionData) ?? null
    const resolvedExecution = executionData ?? SKELETON_EXECUTION

    const handleExport = async () => {
        if (!resolvedBudget || !resolvedBudget.id) return
        try {
            const blob = await financeApi.exportBudgetCsv(resolvedBudget.id) as BlobPart
            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `ejecucion_${resolvedBudget.name}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            toast.success("Exportación iniciada")
        } catch (err) {
            console.error(err)
            toast.error("Error al exportar CSV")
        }
    }

    const collection = useEntityCollection(
        budgetExecutionEntity,
        { rows: resolvedExecution.items },
        { pagination: { mode: "none" } },
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            icon={Wallet}
            title={`Ejecución: ${resolvedBudget.name}`}
            description={`${resolvedBudget.start_date} - ${resolvedBudget.end_date}`}
            footer={
                <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                </Button>
            }
        >
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando detalles del presupuesto">
                {isError && <StaleDataBanner className="mx-4 mt-2" />}
                <div className="space-y-6">
                    <MetricStrip label="Resumen de ejecución presupuestaria">
                        <Metric label="Presupuestado" value={formatMoney(resolvedExecution.summary.total_budgeted)} loading={isLoading} />
                        <Metric label="Ejecutado" value={formatMoney(resolvedExecution.summary.total_actual)} loading={isLoading} />
                        <Metric label="Desviación" value={formatMoney(resolvedExecution.summary.total_variance)} loading={isLoading} />
                    </MetricStrip>
                    <Collection.Root collection={collection} label="Ejecución presupuestaria">
                        <Collection.View
                            table={budgetExecutionViews.table}
                            emptyTitle="Sin datos"
                            emptyDescription="No se encontraron cuentas presupuestarias"
                        />
                    </Collection.Root>
                </div>
            </SkeletonShell>
        </BaseModal>
    )
}
