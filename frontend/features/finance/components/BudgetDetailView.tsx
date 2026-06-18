"use client"

import React, { useState, useEffect } from "react"
import { financeApi } from "../api/financeApi"
import { Download, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, PageHeader, MoneyDisplay, SkeletonShell, StatCard, DataCell } from "@/components/shared"
import { toast } from "sonner"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"

interface BudgetDetailViewProps {
    budgetId: string
}

interface BudgetExecutionItem {
    account_name: string;
    account_code: string;
    budgeted: number;
    actual: number;
    percentage: number;
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
    items: Array.from({ length: 6 }, (_, i) => ({
        account_name: '——————————————————',
        account_code: '————',
        budgeted: 0,
        actual: 0,
        percentage: 0,
    })),
}

const columns: ColumnDef<BudgetExecutionItem>[] = [
    {
        header: "Cuenta",
        accessorKey: "account_name",
        cell: ({ row }) => (
            <div>
                <div className="font-medium">{row.original.account_name}</div>
                <div className="text-xs text-muted-foreground">{row.original.account_code}</div>
            </div>
        ),
    },
    {
        header: "Presupuesto",
        accessorKey: "budgeted",
        cell: ({ row }) => (
            <DataCell.Currency value={row.original.budgeted} digits={0} />
        ),
    },
    {
        header: "Real",
        accessorKey: "actual",
        cell: ({ row }) => (
            <DataCell.Currency value={row.original.actual} digits={0} />
        ),
        meta: { align: "right" as const },
    },
    {
        header: "Ejecución",
        id: "percentage",
        cell: ({ row }) => (
            <DataCell.Progress value={row.original.percentage} subLabel={`${row.original.percentage.toFixed(0)}%`} />
        ),
    },
]

export function BudgetDetailView({ budgetId }: BudgetDetailViewProps) {
    const [executionData, setExecutionData] = useState<BudgetExecutionData | null>(null)
    const [budget, setBudget] = useState<Budget | null>(null)
    const [loading, setLoading] = useState(true)

    const loadData = async () => {
        setLoading(true)
        try {
            const [budgetData, execData] = await Promise.all([
                financeApi.getBudgetDetail(Number(budgetId)),
                financeApi.getBudgetExecution(Number(budgetId))
            ])
            setBudget(budgetData)
            setExecutionData(execData)
        } catch (err) {
            console.error(err)
            toast.error("Error al cargar datos del presupuesto")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        requestAnimationFrame(() => {
            loadData()
        })
    }, [budgetId])

    const handleExport = async () => {
        if (!budget) return
        try {
            const blob = await financeApi.exportBudgetCsv(budget.id)
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

    if (!loading && (!budget || !executionData)) {
        return <div className="text-center py-8 text-destructive">No se pudo cargar la información del presupuesto.</div>
    }

    return (
        <SkeletonShell isLoading={loading} ariaLabel="Cargando detalles del presupuesto">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        label="Presupuestado"
                        value={<MoneyDisplay amount={resolvedExecution.summary.total_budgeted} />}
                        accent="muted"
                    />
                    <StatCard
                        label="Ejecutado"
                        value={<MoneyDisplay amount={resolvedExecution.summary.total_actual} />}
                        accent="muted"
                    />
                    <StatCard
                        label="Desviación"
                        value={<MoneyDisplay amount={resolvedExecution.summary.total_variance} />}
                        accent="muted"
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Detalle por Cuenta</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={columns}
                            data={resolvedExecution.items}
                            variant="embedded"
                            hidePagination
                            emptyState={{ title: "Sin datos", description: "No se encontraron cuentas presupuestarias" }}
                        />
                    </CardContent>
                </Card>
            </div>
        </SkeletonShell>
    )
}
