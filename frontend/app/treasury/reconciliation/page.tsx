"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import StatementImportDialog from "@/components/treasury/StatementImportDialog"

interface BankStatement {
    id: number
    display_id: string
    treasury_account_name: string
    statement_date: string
    opening_balance: string
    closing_balance: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
    state: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
    state_display: string
    imported_by_name: string
    imported_at: string
}

export default function ReconciliationPage() {
    const [statements, setStatements] = useState<BankStatement[]>([])
    const [loading, setLoading] = useState(true)
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    useEffect(() => {
        fetchStatements()
    }, [])

    const fetchStatements = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/statements/')
            setStatements(response.data)
        } catch (error) {
            console.error('Error fetching statements:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleImportSuccess = () => {
        fetchStatements()
        setImportDialogOpen(false)
    }

    const getStateColor = (state: string) => {
        switch (state) {
            case 'DRAFT':
                return 'bg-yellow-100 text-yellow-800'
            case 'CONFIRMED':
                return 'bg-green-100 text-green-800'
            case 'CANCELLED':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getProgressColor = (progress: number) => {
        if (progress === 0) return 'text-gray-500'
        if (progress < 50) return 'text-yellow-600'
        if (progress < 100) return 'text-blue-600'
        return 'text-green-600'
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Conciliación Bancaria</h2>
                    <p className="text-muted-foreground">
                        Gestiona extractos bancarios y reconcilia movimientos
                    </p>
                </div>
                <Button onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Extracto
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Extractos</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statements.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statements.filter(s => s.state === 'CONFIRMED').length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Borradores</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statements.filter(s => s.state === 'DRAFT').length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Líneas Totales</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statements.reduce((acc, s) => acc + s.total_lines, 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Statements Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Extractos Bancarios</CardTitle>
                    <CardDescription>
                        Lista de extractos importados ordenados por fecha
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Cargando extractos...
                        </div>
                    ) : statements.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay extractos</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Comienza importando tu primer extracto bancario
                            </p>
                            <div className="mt-6">
                                <Button onClick={() => setImportDialogOpen(true)}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Importar Extracto
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">ID</th>
                                        <th className="px-6 py-3">Cuenta</th>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Balance Apertura</th>
                                        <th className="px-6 py-3">Balance Cierre</th>
                                        <th className="px-6 py-3">Líneas</th>
                                        <th className="px-6 py-3">Progreso</th>
                                        <th className="px-6 py-3">Estado</th>
                                        <th className="px-6 py-3">Importado Por</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statements.map((statement) => (
                                        <tr
                                            key={statement.id}
                                            className="bg-white border-b hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => window.location.href = `/treasury/reconciliation/${statement.id}`}
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {statement.display_id}
                                            </td>
                                            <td className="px-6 py-4">{statement.treasury_account_name}</td>
                                            <td className="px-6 py-4">
                                                {format(new Date(statement.statement_date), 'dd MMM yyyy', { locale: es })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                ${parseFloat(statement.opening_balance).toLocaleString('es-CL')}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                ${parseFloat(statement.closing_balance).toLocaleString('es-CL')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{statement.total_lines}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {statement.reconciled_lines} reconciliadas
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                                            style={{ width: `${statement.reconciliation_progress}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-sm font-medium ${getProgressColor(statement.reconciliation_progress)}`}>
                                                        {statement.reconciliation_progress}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge className={getStateColor(statement.state)}>
                                                    {statement.state_display}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs">
                                                {statement.imported_by_name}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Import Dialog */}
            <StatementImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onSuccess={handleImportSuccess}
            />
        </div>
    )
}
