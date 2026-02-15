"use client"

import React, { useState, useEffect } from "react"
import api from "@/lib/api"
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
import { PageHeader } from "@/components/shared/PageHeader"
import { toast } from "sonner"
import Link from "next/link"

interface BudgetDetailViewProps {
    budgetId: string
}

export function BudgetDetailView({ budgetId }: BudgetDetailViewProps) {
    const [executionData, setExecutionData] = useState<any>(null)
    const [budget, setBudget] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [budgetId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [budgetRes, execRes] = await Promise.all([
                api.get(`/accounting/budgets/${budgetId}/`),
                api.get(`/accounting/budgets/${budgetId}/execution/`)
            ])
            setBudget(budgetRes.data)
            setExecutionData(execRes.data)
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
            const res = await api.get(`/accounting/budgets/${budget.id}/export_csv/`, {
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([res.data]))
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
        return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando detalles...</div>
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
                        <div className="text-2xl font-bold">
                            {executionData.summary.total_budgeted.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ejecutado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {executionData.summary.total_actual.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Desviación</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${executionData.summary.total_variance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {executionData.summary.total_variance.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
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
                            {executionData.items.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="font-medium">{item.account_name}</div>
                                        <div className="text-xs text-muted-foreground">{item.account_code}</div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.budgeted.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.actual.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
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
