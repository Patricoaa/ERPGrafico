"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft, FileText, Calendar, Banknote, TrendingUp, TrendingDown,
    Undo2, Info, AlertCircle, Loader2, CheckCircle2, GraduationCap
} from "lucide-react"
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
import { formatCurrency } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { Progress } from "@/components/ui/progress"
import { ReconciliationPanel } from "@/features/treasury"

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
    treasury_account: number
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

type ViewMode = 'summary' | 'matching'

export default function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()

    const [view, setView] = useState<ViewMode>('summary')
    const [statement, setStatement] = useState<BankStatement | null>(null)
    const [loading, setLoading] = useState(true)
    const [confirming, setConfirming] = useState(false)
    const [unmatchDialog, setUnmatchDialog] = useState<{ open: boolean, lineId: number | null }>({ open: false, lineId: null })

    useEffect(() => {
        fetchStatement()
    }, [id])

    const fetchStatement = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/treasury/statements/${id}/`)
            setStatement(response.data)
        } catch (error) {
            console.error('Error fetching statement:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleUnmatch = async () => {
        if (!unmatchDialog.lineId) return

        try {
            await api.post(`/treasury/statement-lines/${unmatchDialog.lineId}/unmatch/`)
            await fetchStatement()
        } catch (error) {
            console.error('Error unmatching line:', error)
            alert('Error al deshacer la reconciliación')
        } finally {
            setUnmatchDialog({ open: false, lineId: null })
        }
    }

    const handleConfirmStatement = async () => {
        if (!confirm('¿Confirmar cartola? Esto lo bloqueará y no podrá modificarse.')) return

        try {
            setConfirming(true)
            await api.post(`/treasury/statements/${id}/confirm/`)
            alert('✅ Cartola confirmada exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: any) {
            console.error('Error confirming statement:', error)
            alert(error.response?.data?.error || 'Error al confirmar cartola')
        } finally {
            setConfirming(false)
        }
    }

    const columns: ColumnDef<BankStatementLine>[] = [
        {
            accessorKey: "line_number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="#" />
            ),
            cell: ({ row }) => <span className="text-muted-foreground font-mono text-xs">{row.getValue("line_number")}</span>,
        },
        {
            accessorKey: "transaction_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("transaction_date")} />,
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col max-w-[200px]">
                    <span className="font-medium text-xs truncate" title={row.getValue("description")}>{row.getValue("description")}</span>
                    {row.original.reference && (
                        <span className="text-[10px] text-muted-foreground truncate">{row.original.reference}</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "debit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cargo" />
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("debit"))
                return val > 0 ? <DataCell.Currency value={val} className="text-destructive font-bold" /> : <span className="text-muted-foreground/30 ml-4">-</span>
            },
        },
        {
            accessorKey: "credit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Abono" />
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("credit"))
                return val > 0 ? <DataCell.Currency value={val} className="text-emerald-600 font-bold" /> : <span className="text-muted-foreground/30 ml-4">-</span>
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("balance")} className="font-mono text-[11px]" />,
        },
        {
            accessorKey: "reconciliation_state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("reconciliation_state") as string
                let variant: any = 'secondary'
                let label = row.original.reconciliation_state_display
                let tooltip = ""

                if (state === 'MATCHED') {
                    variant = 'warning'
                    label = "Sugerencia de Match"
                    tooltip = "Esta línea tiene un match sugerido. Revise y confirme para finalizar."
                }
                if (state === 'RECONCILED') {
                    variant = 'success'
                    label = "Conciliado"
                    tooltip = "Confirmado y asiento contable generado."
                }
                if (state === 'DISPUTED') {
                    variant = 'destructive'
                    label = "En Disputa"
                }
                if (state === 'EXCLUDED') {
                    variant = 'outline'
                    label = "Excluido"
                    tooltip = "Esta línea no será considerada en la conciliación."
                }
                if (state === 'UNRECONCILED') {
                    label = "Sin Conciliar"
                }

                return (
                    <div title={tooltip}>
                        <DataCell.Badge variant={variant}>
                            {label}
                        </DataCell.Badge>
                    </div>
                )
            },
        },
        {
            id: "matched_payment",
            header: "Pago Vinculado",
            cell: ({ row }) => (
                <span className="text-[10px] font-mono text-muted-foreground">
                    {row.original.matched_payment_info?.display_id || '-'}
                </span>
            ),
        },
        {
            id: "actions",
            header: "Acción",
            cell: ({ row }) => {
                const state = row.original.reconciliation_state
                const canUnmatch = ['MATCHED', 'RECONCILED', 'EXCLUDED'].includes(state) && statement?.state !== 'CONFIRMED'

                return (
                    <div className="flex justify-center">
                        {canUnmatch && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setUnmatchDialog({ open: true, lineId: row.original.id })}
                                title="Deshacer reconciliación"
                            >
                                <Undo2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )
            },
        },
    ]

    if (loading) {
        return (
            <div className="flex-1 p-8 pt-6">
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                    <p className="text-muted-foreground text-sm font-medium">Cargando detalles de la cartola...</p>
                </div>
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex-1 p-8 pt-6">
                <Card className="max-w-md mx-auto mt-12">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No se pudo encontrar la cartola solicitada.</p>
                        <Button onClick={() => router.push('/treasury/reconciliation')} className="mt-4 w-full">
                            Volver al listado
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // --- RENDER MATCHING VIEW ---
    if (view === 'matching') {
        const canConfirm = statement.reconciliation_progress === 100

        return (
            <div className="flex-1 space-y-6 p-8 pt-6 bg-muted/20 min-h-screen">
                {/* Header Area */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full shadow-sm"
                                onClick={() => setView('summary')}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-bold tracking-tight text-foreground/80">
                                        Banco de Trabajo
                                    </h2>
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold px-3">
                                        {statement.display_id}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground text-sm">{statement.treasury_account_name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center gap-3 mr-4 text-right">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Sincronización</p>
                                    <p className="text-xs font-black text-foreground/70">{statement.reconciled_lines} de {statement.total_lines} líneas procesadas</p>
                                </div>
                            </div>
                            {canConfirm && (
                                <Button
                                    onClick={handleConfirmStatement}
                                    disabled={confirming}
                                    className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 px-6 font-bold"
                                >
                                    {confirming ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Finalizando...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Confirmar Cartola
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="text-muted-foreground">
                                <GraduationCap className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                </div>

                {/* Core Matching Engine (Panel) */}
                <ReconciliationPanel
                    statementId={statement.id}
                    treasuryAccountId={statement.treasury_account}
                    onComplete={fetchStatement}
                />

                {/* Context Help Footer */}
                {!canConfirm && (
                    <div className="flex items-center justify-center p-8 opacity-40 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white px-4 py-2 rounded-full border shadow-sm">
                            <Info className="h-3.5 w-3.5" />
                            Para confirmar la cartola, debes reconciliar o excluir el 100% de las transacciones.
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // --- RENDER SUMMARY VIEW ---
    const totalDebits = statement.lines.reduce((acc, line) => acc + parseFloat(line.debit), 0)
    const totalCredits = statement.lines.reduce((acc, line) => acc + parseFloat(line.credit), 0)
    const netMovement = totalCredits - totalDebits

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 bg-muted/20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push('/treasury/reconciliation')}
                        className="rounded-full shadow-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground/90">{statement.display_id}</h2>
                            <DataCell.Badge variant={statement.state === 'CONFIRMED' ? 'success' : 'secondary'}>
                                {statement.state_display}
                            </DataCell.Badge>
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">{statement.treasury_account_name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {statement.state !== 'CONFIRMED' && statement.reconciliation_progress < 100 && (
                        <Button
                            onClick={() => setView('matching')}
                            className="bg-primary hover:bg-primary/90 shadow-sm"
                        >
                            <span className="mr-2">⚡</span>
                            Reconciliar
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Apertura</CardTitle>
                        <Banknote className="h-3.5 w-3.5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {formatCurrency(statement.opening_balance)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {format(new Date(statement.statement_date), 'dd MMMM yyyy', { locale: es })}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Cierre</CardTitle>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {formatCurrency(statement.closing_balance)}
                        </div>
                        <p className={`text-[10px] font-medium mt-0.5 flex items-center gap-1 ${netMovement >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {netMovement >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {netMovement >= 0 ? 'Excedente' : 'Déficit'}: {formatCurrency(Math.abs(netMovement))}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Cargos (Sale)</CardTitle>
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono text-destructive/80">
                            {formatCurrency(totalDebits)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {statement.lines.filter(l => parseFloat(l.debit) > 0).length} cargos detectados
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Abonos (Entra)</CardTitle>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono text-emerald-600/80">
                            {formatCurrency(totalCredits)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {statement.lines.filter(l => parseFloat(l.credit) > 0).length} abonos detectados
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Progress Bar Container */}
            <div className="bg-card p-4 rounded-xl border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado de la Conciliación</span>
                        <Info className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-bold text-primary">{statement.reconciliation_progress}% completado</span>
                </div>
                <Progress value={statement.reconciliation_progress} className="h-2.5 bg-muted" />
                <div className="mt-2 text-[10px] text-muted-foreground flex justify-between">
                    <span>{statement.reconciled_lines} líneas procesadas</span>
                    <span>{statement.total_lines - statement.reconciled_lines} líneas pendientes</span>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={statement.lines}
                cardMode
                filterColumn="description"
                searchPlaceholder="Buscar por descripción o referencia..."
                facetedFilters={[
                    {
                        column: "reconciliation_state",
                        title: "Estado Reconciliación",
                        options: [
                            { label: "Sin Conciliar", value: "UNRECONCILED" },
                            { label: "Conciliado", value: "RECONCILED" },
                            { label: "Sugerencia (Match)", value: "MATCHED" },
                            { label: "Excluido", value: "EXCLUDED" },
                            { label: "En Disputa", value: "DISPUTED" },
                        ]
                    }
                ]}
                useAdvancedFilter={true}
                defaultPageSize={20}
            />

            {/* Metadata Footer */}
            <div className="flex items-center justify-between px-2 pt-2">
                <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="font-semibold uppercase">Importado:</span>
                        <span>{format(new Date(statement.imported_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="font-semibold uppercase">Por:</span>
                        <span>{statement.imported_by_name}</span>
                    </div>
                </div>
                <div className="text-[10px] text-muted-foreground/40 italic">
                    Referencia del sistema: #{statement.id}
                </div>
            </div>

            <AlertDialog open={unmatchDialog.open} onOpenChange={(open) => !open && setUnmatchDialog(prev => ({ ...prev, open: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Deshacer reconciliación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción desvinculará la línea del pago y la devolverá al estado &quot;No Reconciliado&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnmatch} className="bg-destructive hover:bg-red-700">Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
