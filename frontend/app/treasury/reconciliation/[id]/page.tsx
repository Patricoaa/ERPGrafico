"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, FileText, Calendar, Banknote, TrendingUp, TrendingDown, Undo2 } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"

interface BankStatementLine {
    id: number
    line_number: number
    transaction_date: string
    description: string
    reference: string
    transaction_id: string
    debit: string
    credit: string
    balance: string
    reconciliation_state: string
    reconciliation_state_display: string
    matched_payment_info: {
        id: number
        display_id: string
        amount: string
        date: string
    } | null
}

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
    state: string
    state_display: string
    imported_by_name: string
    imported_at: string
    lines: BankStatementLine[]
}

export default function StatementDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [statement, setStatement] = useState<BankStatement | null>(null)
    const [loading, setLoading] = useState(true)
    const [unmatchDialog, setUnmatchDialog] = useState<{ open: boolean, lineId: number | null }>({ open: false, lineId: null })

    useEffect(() => {
        fetchStatement()
    }, [params.id])

    const fetchStatement = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/treasury/statements/${params.id}/`)
            setStatement(response.data)
        } catch (error) {
            console.error('Error fetching statement:', error)
        } finally {
            setLoading(false)
        }
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

    const getReconciliationStateColor = (state: string) => {
        switch (state) {
            case 'UNRECONCILED':
                return 'bg-gray-100 text-gray-800'
            case 'MATCHED':
                return 'bg-blue-100 text-blue-800'
            case 'RECONCILED':
                return 'bg-green-100 text-green-800'
            case 'DISPUTED':
                return 'bg-red-100 text-red-800'
            case 'EXCLUDED':
                return 'bg-gray-200 text-gray-600'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const handleUnmatch = async () => {
        if (!unmatchDialog.lineId) return

        try {
            await api.post(`/treasury/statement-lines/${unmatchDialog.lineId}/unmatch/`)
            await fetchStatement() // Refresh data
        } catch (error) {
            console.error('Error unmatching line:', error)
            alert('Error al deshacer la reconciliación')
        } finally {
            setUnmatchDialog({ open: false, lineId: null })
        }
    }

    if (loading) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Cargando extracto...</p>
                </div>
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="text-center py-12">
                    <p className="text-red-600">Extracto no encontrado</p>
                    <Button onClick={() => router.push('/treasury/reconciliation')} className="mt-4">
                        Volver a Extractos
                    </Button>
                </div>
            </div>
        )
    }

    const totalDebits = statement.lines.reduce((acc, line) => acc + parseFloat(line.debit), 0)
    const totalCredits = statement.lines.reduce((acc, line) => acc + parseFloat(line.credit), 0)
    const netMovement = totalCredits - totalDebits

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/treasury/reconciliation')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{statement.display_id}</h2>
                        <p className="text-muted-foreground">{statement.treasury_account_name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={getStateColor(statement.state)}>
                        {statement.state_display}
                    </Badge>
                    {statement.state !== 'CONFIRMED' && statement.reconciliation_progress < 100 && (
                        <Button onClick={() => router.push(`/treasury/reconciliation/${params.id}/match`)}>
                            Reconciliar
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Balance Apertura</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">
                            ${parseFloat(statement.opening_balance).toLocaleString('es-CL')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(statement.statement_date), 'dd MMM yyyy', { locale: es })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Balance Cierre</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">
                            ${parseFloat(statement.closing_balance).toLocaleString('es-CL')}
                        </div>
                        <p className={`text-xs flex items-center gap-1 ${netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netMovement >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            Movimiento: ${Math.abs(netMovement).toLocaleString('es-CL')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Débitos</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-red-600">
                            ${totalDebits.toLocaleString('es-CL')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {statement.lines.filter(l => parseFloat(l.debit) > 0).length} transacciones
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Créditos</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-green-600">
                            ${totalCredits.toLocaleString('es-CL')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {statement.lines.filter(l => parseFloat(l.credit) > 0).length} transacciones
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Reconciliation Progress */}
            <Card>
                <CardHeader>
                    <CardTitle>Progreso de Reconciliación</CardTitle>
                    <CardDescription>
                        {statement.reconciled_lines} de {statement.total_lines} líneas reconciliadas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-200 rounded-full h-4">
                            <div
                                className="bg-blue-600 h-4 rounded-full transition-all"
                                style={{ width: `${statement.reconciliation_progress}%` }}
                            />
                        </div>
                        <span className="text-lg font-bold text-blue-600">
                            {statement.reconciliation_progress}%
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Statement Lines Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Líneas del Extracto</CardTitle>
                    <CardDescription>
                        {statement.total_lines} transacciones bancarias
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Descripción</th>
                                    <th className="px-4 py-3">Referencia</th>
                                    <th className="px-4 py-3 text-right">Débito</th>
                                    <th className="px-4 py-3 text-right">Crédito</th>
                                    <th className="px-4 py-3 text-right">Saldo</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Pago</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statement.lines.map((line) => (
                                    <tr key={line.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-500">
                                            {line.line_number}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {format(new Date(line.transaction_date), 'dd/MM/yy', { locale: es })}
                                        </td>
                                        <td className="px-4 py-3 max-w-xs truncate">
                                            {line.description}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {line.reference || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">
                                            {parseFloat(line.debit) > 0
                                                ? `$${parseFloat(line.debit).toLocaleString('es-CL')}`
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-green-600">
                                            {parseFloat(line.credit) > 0
                                                ? `$${parseFloat(line.credit).toLocaleString('es-CL')}`
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold">
                                            ${parseFloat(line.balance).toLocaleString('es-CL')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={getReconciliationStateColor(line.reconciliation_state)}>
                                                {line.reconciliation_state_display}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {line.matched_payment_info
                                                ? line.matched_payment_info.display_id
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {(line.reconciliation_state === 'MATCHED' || line.reconciliation_state === 'RECONCILED' || line.reconciliation_state === 'EXCLUDED') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-500 hover:text-red-600"
                                                    title="Deshacer reconciliación"
                                                    onClick={() => setUnmatchDialog({ open: true, lineId: line.id })}
                                                    disabled={statement.state === 'CONFIRMED'}
                                                >
                                                    <Undo2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={unmatchDialog.open} onOpenChange={(open) => !open && setUnmatchDialog(prev => ({ ...prev, open: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Deshacer reconciliación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción desvinculará la línea del pago y la devolverá al estado "No Reconciliado".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnmatch}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Metadata */}
            <Card>
                <CardHeader>
                    <CardTitle>Información del Extracto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Importado por:</span>
                        <span className="font-medium">{statement.imported_by_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha de importación:</span>
                        <span className="font-medium">
                            {format(new Date(statement.imported_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
