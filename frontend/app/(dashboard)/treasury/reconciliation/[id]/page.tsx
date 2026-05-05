"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft, FileText, Calendar, Banknote, TrendingUp, TrendingDown,
    Undo2, Info, AlertCircle, Loader2, CheckCircle2, GraduationCap, ExternalLink, Activity
} from "lucide-react"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { PageHeader } from "@/components/shared/PageHeader"
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
import { parseISO } from "date-fns"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { Progress } from "@/components/ui/progress"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

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

export default function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()

    const [statement, setStatement] = useState<BankStatement | null>(null)
    const [loading, setLoading] = useState(true)
    const [confirming, setConfirming] = useState(false)
    const [unmatchDialog, setUnmatchDialog] = useState<{ open: boolean, lineId: number | null }>({ open: false, lineId: null })
    const [paymentModal, setPaymentModal] = useState<{ open: boolean, id: number | null }>({ open: false, id: null })

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
            toast.error('Error al deshacer la reconciliación')
        } finally {
            setUnmatchDialog({ open: false, lineId: null })
        }
    }

    const confirmAction = useConfirmAction(async () => {
        try {
            setConfirming(true)
            await api.post(`/treasury/statements/${id}/confirm/`)
            toast.success('Cartola confirmada exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: unknown) {
            console.error('Error confirming statement:', error)
            showApiError(error, 'Error al confirmar cartola')
        } finally {
            setConfirming(false)
        }
    })

    const handleConfirmStatement = () => confirmAction.requestConfirm()

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
                    <span className="text-[10px] text-muted-foreground truncate"> {/* intentional: badge density */} {row.original.reference}</span>
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
                return val > 0 ? (
                    <DataCell.Currency value={val} className="text-expense font-black" />
                ) : (
                    <span className="text-muted-foreground/30 ml-4">-</span>
                )
            },
        },
        {
            accessorKey: "credit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Abono" />
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("credit"))
                return val > 0 ? (
                    <DataCell.Currency value={val} className="text-income font-black" />
                ) : (
                    <span className="text-muted-foreground/30 ml-4">-</span>
                )
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("balance")} className="font-mono text-xs" />,
        },
        {
            accessorKey: "reconciliation_state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("reconciliation_state") as string
                const label = row.original.reconciliation_state_display
                return (
                    <DataCell.Status 
                        status={state} 
                        label={state === 'MATCHED' ? "Sugerencia Match" : label}
                    />
                )
            },
        },
        {
            id: "matched_payment",
            header: "Pago Vinculado",
            cell: ({ row }) => {
                const info = row.original.matched_payment_info
                if (!info) return <span className="text-muted-foreground/30 ml-4">-</span>
                
                return (
                    <button 
                        onClick={() => setPaymentModal({ open: true, id: info.id })}
                        className="text-[10px] font-mono font-bold text-primary hover:underline flex items-center gap-1 group w-full justify-center"
                    >
                        {info.display_id}
                        <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                )
            },
        },
        createActionsColumn<BankStatementLine>({
            renderActions: (line) => {
                const state = line.reconciliation_state
                const canUnmatch = ['MATCHED', 'RECONCILED', 'EXCLUDED'].includes(state) && statement?.state !== 'CONFIRMED'

                return canUnmatch ? (
                    <DataCell.Action
                        icon={Undo2}
                        title="Deshacer reconciliación"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setUnmatchDialog({ open: true, lineId: line.id })}
                    />
                ) : <></>
            }
        }),
    ]

    if (loading) return (
        <div className="flex-1 p-8 pt-6">
            <TableSkeleton rows={12} columns={5} />
        </div>
    )

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


    // --- RENDER SUMMARY VIEW ---
    const totalDebits = statement.lines.reduce((acc, line) => acc + parseFloat(line.debit), 0)
    const totalCredits = statement.lines.reduce((acc, line) => acc + parseFloat(line.credit), 0)
    const netMovement = totalCredits - totalDebits

    const navigation = {
        tabs: [
            { 
                value: "treasury", 
                label: "Tesorería", 
                iconName: "landmark",
                href: "/treasury",
                subTabs: [
                    { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury/reconciliation?tab=statements" },
                    { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury/reconciliation?tab=dashboard" },
                    { value: "intelligence", label: "Inteligencia", iconName: "brain", href: "/treasury/reconciliation?tab=intelligence" },
                ]
            },
        ],
        activeValue: "treasury",
        subActiveValue: "statements",
        breadcrumbs: [
            { label: statement.display_id }
        ]
    }

    return (
        <div className="flex-1 space-y-4 pt-2">
            <PageHeader
                title={statement.display_id}
                description={statement.treasury_account_name}
                variant="minimal"
                navigation={navigation}
                status={{
                    label: statement.state_display || statement.state,
                    type: statement.state === 'CONFIRMED' ? 'synced' : 'info'
                }}
                titleActions={
                    statement.state !== 'CONFIRMED' && statement.reconciliation_progress < 100 && (
                        <Button
                            onClick={() => router.push(`/treasury/reconciliation/${statement.id}/workbench`)}
                            className="bg-primary hover:bg-primary/90 shadow-sm"
                        >
                            <Activity className="mr-2 h-4 w-4" />
                            Reconciliar
                        </Button>
                    )
                }
            />

            {/* Summary Grid */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm bg-card border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Apertura</CardTitle>
                        <Banknote className="h-3.5 w-3.5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {formatCurrency(statement.opening_balance)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"> {/* intentional: badge density */}
                            <Calendar className="h-2.5 w-2.5" />
                            {format(new Date(statement.statement_date), 'dd MMMM yyyy', { locale: es })}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm bg-card border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Cierre</CardTitle>
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {formatCurrency(statement.closing_balance)}
                        </div>
                        <p className={`text-[10px] font-black mt-0.5 flex items-center gap-1 ${netMovement >= 0 ? 'text-income' : 'text-expense'}`}> {/* intentional: badge density */}
                            {netMovement >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {netMovement >= 0 ? 'Excedente' : 'Déficit'}: {formatCurrency(Math.abs(netMovement))}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm bg-card border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Cargos (Sale)</CardTitle>
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono text-expense">
                            {formatCurrency(totalDebits)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5"> {/* intentional: badge density */}
                            {statement.lines.filter(l => parseFloat(l.debit) > 0).length} cargos detectados
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm bg-card border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Abonos (Entra)</CardTitle>
                        <TrendingUp className="h-3.5 w-3.5 text-success/50" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono text-income">
                            {formatCurrency(totalCredits)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5"> {/* intentional: badge density */}
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
                <div className="mt-2 text-[10px] text-muted-foreground flex justify-between"> {/* intentional: badge density */}
                    <span>{statement.reconciled_lines} líneas procesadas</span>
                    <span>{statement.total_lines - statement.reconciled_lines} sin conciliar</span>
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
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground"> {/* intentional: badge density */}
                        <span className="font-semibold uppercase">Importado:</span>
                        <span>{format(new Date(statement.imported_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground"> {/* intentional: badge density */}
                        <span className="font-semibold uppercase">Por:</span>
                        <span>{statement.imported_by_name}</span>
                    </div>
                </div>
                <div className="text-[10px] text-muted-foreground/40 italic"> {/* intentional: badge density */}
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
                        <AlertDialogAction onClick={handleUnmatch} className="bg-destructive hover:bg-destructive">Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <ActionConfirmModal
                open={confirmAction.isOpen}
                onOpenChange={(open) => { if (!open) confirmAction.cancel() }}
                onConfirm={confirmAction.confirm}
                title="Confirmar Cartola"
                description="¿Está seguro de confirmar esta cartola? Esto validará todas las conciliaciones, actualizará los saldos de la cuenta y bloqueará la cartola para futuras modificaciones."
                confirmText="Confirmar"
            />
        </div>
    )
}
