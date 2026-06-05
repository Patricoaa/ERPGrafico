"use client"

import { formatCurrency } from "@/lib/money"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { showApiError } from "@/lib/errors"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Calendar, Banknote, TrendingUp, TrendingDown,
    Undo2, Info, AlertCircle, ExternalLink, Activity
} from "lucide-react"
import { ActionConfirmModal, SkeletonShell } from '@/components/shared'
import { BankPageHeader } from "@/features/treasury"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, DataCell } from '@/components/shared'
import { Progress } from "@/components/ui/progress"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { toast } from "sonner"

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
    matched_payment_info: { id: number; display_id: string; amount: string; date: string } | null
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

export default function BankStatementDetailPage({
    params,
}: {
    params: Promise<{ bankId: string; statementId: string }>
}) {
    const { bankId, statementId } = use(params)
    const bankIdNum = Number(bankId)
    const router = useRouter()

    const [statement, setStatement] = useState<BankStatement | null>(null)
    const [loading, setLoading] = useState(true)
    const [unmatchDialog, setUnmatchDialog] = useState<{ open: boolean; lineId: number | null }>({ open: false, lineId: null })
    const [confirming, setConfirming] = useState(false)

    const reconciliationBase = `/treasury/centro-bancos/${bankId}/reconciliation`

    const fetchStatement = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/treasury/statements/${statementId}/`)
            setStatement(response.data)
        } catch {
            // handled below
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const response = await api.get(`/treasury/statements/${statementId}/`)
                if (!cancelled) setStatement(response.data)
            } catch {
                if (!cancelled) setStatement(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [statementId])

    const handleUnmatch = async () => {
        if (!unmatchDialog.lineId) return
        try {
            await api.post(`/treasury/statement-lines/${unmatchDialog.lineId}/unmatch/`)
            await fetchStatement()
        } catch {
            toast.error('Error al deshacer la reconciliación')
        } finally {
            setUnmatchDialog({ open: false, lineId: null })
        }
    }

    const confirmAction = useConfirmAction(async () => {
        try {
            setConfirming(true)
            await api.post(`/treasury/statements/${statementId}/confirm/`)
            toast.success('Cartola confirmada exitosamente')
            router.push(reconciliationBase)
        } catch (error: unknown) {
            showApiError(error, 'Error al confirmar cartola')
        } finally {
            setConfirming(false)
        }
    })

    const columns: ColumnDef<BankStatementLine>[] = [
        {
            accessorKey: "line_number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
            cell: ({ row }) => <span className="text-muted-foreground font-mono text-xs">{row.getValue("line_number")}</span>,
        },
        {
            accessorKey: "transaction_date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("transaction_date")} />,
        },
        {
            accessorKey: "description",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Descripción" />,
            cell: ({ row }) => (
                <div className="flex flex-col max-w-[200px]">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="font-medium text-xs truncate">{row.getValue("description")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{row.getValue("description")}</TooltipContent>
                    </Tooltip>
                    {row.original.reference && (
                        <span className="text-[10px] text-muted-foreground truncate">{row.original.reference}</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "debit",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo" />,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("debit"))
                return val > 0 ? <DataCell.Currency value={val} /> : <span className="text-muted-foreground/30 ml-4">-</span>
            },
        },
        {
            accessorKey: "credit",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Abono" />,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("credit"))
                return val > 0 ? <DataCell.Currency value={val} /> : <span className="text-muted-foreground/30 ml-4">-</span>
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Saldo" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("balance")} />,
        },
        {
            accessorKey: "reconciliation_state",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => {
                const state = row.getValue("reconciliation_state") as string
                return (
                    <DataCell.Status
                        status={state}
                        label={state === 'MATCHED' ? "Sugerencia Match" : row.original.reconciliation_state_display}
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
                    <span className="text-[10px] font-mono font-bold text-primary flex items-center gap-1">
                        {info.display_id}
                        <ExternalLink className="h-2 w-2" />
                    </span>
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

    if (loading) return <div className="flex-1"><SkeletonShell isLoading ariaLabel="Cargando..." /></div>

    if (!statement) {
        return (
            <div className="flex-1">
                <Card className="max-w-md mx-auto mt-12">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No se pudo encontrar la cartola solicitada.</p>
                        <Button onClick={() => router.push(reconciliationBase)} className="mt-4 w-full">
                            Volver al listado
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const totalDebits = statement.lines.reduce((acc, l) => acc + parseFloat(l.debit), 0)
    const totalCredits = statement.lines.reduce((acc, l) => acc + parseFloat(l.credit), 0)
    const netMovement = totalCredits - totalDebits

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <BankPageHeader
                bankId={bankIdNum}
                title={statement.display_id}
                description={statement.treasury_account_name}
                status={{ label: statement.state_display || statement.state, type: statement.state === 'CONFIRMED' ? 'synced' : 'info' }}
                breadcrumbs={[
                    { label: "Conciliación", href: reconciliationBase },
                    { label: statement.display_id },
                ]}
            />

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pt-2 pb-4">
                {/* Summary Grid */}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="shadow-sm bg-card border">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Apertura</CardTitle>
                            <Banknote className="h-3.5 w-3.5 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold font-mono">{formatCurrency(statement.opening_balance)}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
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
                            <div className="text-xl font-bold font-mono">{formatCurrency(statement.closing_balance)}</div>
                            <p className={`text-[10px] font-black mt-0.5 flex items-center gap-1 ${netMovement >= 0 ? 'text-income' : 'text-expense'}`}>
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
                            <div className="text-xl font-bold font-mono text-expense">{formatCurrency(totalDebits)}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
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
                            <div className="text-xl font-bold font-mono text-income">{formatCurrency(totalCredits)}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {statement.lines.filter(l => parseFloat(l.credit) > 0).length} abonos detectados
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Progress */}
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
                        <span>{statement.total_lines - statement.reconciled_lines} sin conciliar</span>
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={statement.lines}
                    variant="embedded"
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
                    useAdvancedFilter
                    defaultPageSize={20}
                    createAction={
                        statement.state !== 'CONFIRMED' && statement.reconciliation_progress < 100 ? (
                            <Button onClick={() => router.push(`${reconciliationBase}/${statement.id}/workbench`)}>
                                <Activity className="mr-2 h-4 w-4" />
                                Reconciliar
                            </Button>
                        ) : undefined
                    }
                />

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
                    <div className="text-[10px] text-muted-foreground/40 italic">Referencia del sistema: #{statement.id}</div>
                </div>
            </div>

            <ActionConfirmModal
                open={unmatchDialog.open}
                onOpenChange={(open) => !open && setUnmatchDialog(prev => ({ ...prev, open: false }))}
                onConfirm={handleUnmatch}
                title="¿Deshacer reconciliación?"
                description='Esta acción desvinculará la línea del pago y la devolverá al estado "No Reconciliado".'
                variant="destructive"
                confirmText="Confirmar"
            />

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
