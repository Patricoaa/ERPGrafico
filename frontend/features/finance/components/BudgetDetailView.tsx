"use client"

import React, { useState, useEffect } from "react"
import { financeApi } from "../api/financeApi"
import { Download, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { PageHeader, LoadingFallback, MoneyDisplay } from "@/components/shared"
import { toast } from "sonner"
import Link from "next/link"

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

export function BudgetDetailView({ budgetId }: BudgetDetailViewProps) {
    const [executionData, setExecutionData] = useState<BudgetExecutionData | null>(null)
    const [budget, setBudget] = useState<Budget | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [budgetId])

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

    if (loading) {
        return <div className="flex items-center justify-center h-64"><LoadingFallback message="Cargando detalles..." /></div>
    }

    if (!budget || !executionData) {
        return <div className="text-center py-8 text-destructive">No se pudo cargar la información del presupuesto.</div>
    }

    return (
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
                title={`Ejecución: ${budget.name}`}
                description={`${budget.start_date} - ${budget.end_date}`}
                titleActions={
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Presupuestado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black font-heading tracking-tighter">
                            <MoneyDisplay amount={executionData.summary.total_budgeted} digits={0} />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ejecutado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black font-heading tracking-tighter">
                            <MoneyDisplay amount={executionData.summary.total_actual} digits={0} />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Desviación</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black font-heading tracking-tighter">
                            <MoneyDisplay 
                                amount={executionData.summary.total_variance} 
                                digits={0} 
                                showColor={true} 
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detalle por Cuenta</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cuenta</TableHead>
                                <TableHead className="text-right">Presupuesto</TableHead>
                                <TableHead className="text-right">Real</TableHead>
                                <TableHead className="text-center w-[200px]">Ejecución</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {executionData.items.map((item, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="font-medium">{item.account_name}</div>
                                        <div className="text-xs text-muted-foreground">{item.account_code}</div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <MoneyDisplay amount={item.budgeted} digits={0} />
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <MoneyDisplay amount={item.actual} digits={0} />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={Math.min(item.percentage, 100)} className="h-2" />
                                            <span className="text-xs w-10 text-right">{item.percentage.toFixed(0)}%</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
