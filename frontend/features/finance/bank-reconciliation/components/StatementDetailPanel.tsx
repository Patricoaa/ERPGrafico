"use client"

import { formatCurrency } from "@/lib/money"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Calendar, Banknote, TrendingUp, TrendingDown,
    Info, AlertCircle, Activity
} from "lucide-react"
import { ActionConfirmModal, DataTable, DataTableColumnHeader, DataCell, SkeletonShell, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { statementLineUnmatchActions, type StatementLineUnmatchActionsCtx } from "@/features/treasury"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useStatementQuery, useUnmatchMutation } from "@/features/finance"
import { type ColumnDef } from "@tanstack/react-table"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import type { UnifiedSearchConfig } from '@/types/unified-search'

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

interface StatementDetailPanelProps {
    statementId: number
    bankId?: number
    reconciliationBase?: string
    hideCreateAction?: boolean
    /** Solo muestra la tabla de líneas — sin resumen, progreso, metadatos ni segmentation */
    detailOnly?: boolean
}

export function StatementDetailPanel({
    statementId,
    bankId,
    reconciliationBase,
    hideCreateAction = false,
    detailOnly = false,
}: StatementDetailPanelProps) {
    const router = useRouter()
    const defaultBase = reconciliationBase ?? (bankId ? `/treasury/bank-center/${bankId}/reconciliation` : `/treasury/reconciliation`)
    const basePath = reconciliationBase ?? (bankId ? `/treasury/bank-center/${bankId}/reconciliation` : `/treasury/reconciliation`)

    const [unmatchDialog, setUnmatchDialog] = useState<{ open: boolean; lineId: number | null }>({ open: false, lineId: null })
    const statementQuery = useStatementQuery(statementId)
    const statement = statementQuery.data as BankStatement | null
    const loading = statementQuery.isLoading
    const fetchStatement = statementQuery.refetch

    const { unmatch } = useUnmatchMutation(statementId, (statement as BankStatement | null)?.treasury_account ?? 0)

    const statementSearchConfig = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [],
        filters: [
            {
                type: 'multi',
                key: 'reconciliation_state',
                label: 'Estado Reconciliación',
                serverParam: 'reconciliation_state',
                options: [
                    { label: "Sin Conciliar", value: "UNRECONCILED" },
                    { label: "Conciliado", value: "RECONCILED" },
                    { label: "Sugerencia (Match)", value: "MATCHED" },
                    { label: "Excluido", value: "EXCLUDED" },
                    { label: "En Disputa", value: "DISPUTED" },
                ],
            },
        ],
    }), [])

    const search = useUnifiedSearch(statementSearchConfig)

    const filteredLines = useMemo(() => {
        if (!search.filters.reconciliation_state) return statement?.lines ?? []
        const allowed = new Set(search.filters.reconciliation_state.split(','))
        return (statement?.lines ?? []).filter(l => allowed.has(l.reconciliation_state))
    }, [statement?.lines, search.filters.reconciliation_state])

    const statementLineUnmatchActionsCtx: StatementLineUnmatchActionsCtx = {
        onUnmatch: (lineId) => setUnmatchDialog({ open: true, lineId }),
        canUnmatch: (item) => {
            const line = item as { reconciliation_state?: string }
            const state = line.reconciliation_state || ''
            return ['MATCHED', 'RECONCILED', 'EXCLUDED'].includes(state) && statement?.state !== 'CONFIRMED'
        },
    }

    const handleUnmatch = async () => {
        if (!unmatchDialog.lineId) return
        try {
            await unmatch(unmatchDialog.lineId)
            await fetchStatement()
        } catch {
            toast.error('Error al deshacer la reconciliación')
        } finally {
            setUnmatchDialog({ open: false, lineId: null })
        }
    }

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
                    </span>
                )
            },
        },
        statementLineUnmatchActions.column(statementLineUnmatchActionsCtx) as ColumnDef<BankStatementLine>,
    ]

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
                        <Button onClick={() => router.push(defaultBase)} className="mt-4 w-full">
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
        <SkeletonShell isLoading={loading} ariaLabel="Cargando cartola">
        <div className={detailOnly ? "" : "space-y-4"}>
            {!detailOnly && (
                <>
                    {/* Summary Grid */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="shadow-card bg-card border">
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
                        <Card className="shadow-card bg-card border">
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
                        <Card className="shadow-card bg-card border">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Cargos (Sale)</CardTitle>
                                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold font-mono"><DataCell.CurrencyFlow value={totalDebits} direction="outflow" showIcon={false} /></div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {statement.lines.filter(l => parseFloat(l.debit) > 0).length} cargos detectados
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-card bg-card border">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Abonos (Entra)</CardTitle>
                                <TrendingUp className="h-3.5 w-3.5 text-success/50" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold font-mono"><DataCell.CurrencyFlow value={totalCredits} direction="inflow" showIcon={false} /></div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {statement.lines.filter(l => parseFloat(l.credit) > 0).length} abonos detectados
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Progress */}
                    <div className="bg-card p-4 rounded-md border shadow-card">
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
                </>
            )}

            <DataTable
                columns={columns}
                data={filteredLines}
                variant="embedded"
                unifiedSearch={
                    !detailOnly ? (
                        <UnifiedSearchBar
                            config={statementSearchConfig}
                            chips={search.chips}
                            isFiltered={search.isFiltered}
                            inputValue={search.inputValue}
                            onInputChange={search.setInputValue}
                            onApply={search.applyFilter}
                            onRemove={search.removeFilter}
                            onClearAll={search.clearAll}
                            groupBy={search.groupBy}
                            onGroupBySelect={search.setGroupBy}
                            paramValues={search.paramValues}
                        />
                    ) : undefined
                }
                showReset={!detailOnly ? search.isFiltered : undefined}
                onReset={!detailOnly ? search.clearAll : undefined}
                defaultPageSize={20}
                createAction={
                    !hideCreateAction && statement.state !== 'CONFIRMED' && statement.reconciliation_progress < 100 ? (
                        <Button onClick={() => router.push(`${basePath}/${statement.id}/workbench`)}>
                            <Activity className="mr-2 h-4 w-4" />
                            Reconciliar
                        </Button>
                    ) : undefined
                }
            />

            {!detailOnly && (
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
            )}

            <ActionConfirmModal
                open={unmatchDialog.open}
                onOpenChange={(open) => !open && setUnmatchDialog(prev => ({ ...prev, open: false }))}
                onConfirm={handleUnmatch}
                title="¿Deshacer reconciliación?"
                description='Esta acción desvinculará la línea del pago y la devolverá al estado "No Reconciliado".'
                variant="destructive"
                confirmText="Confirmar"
            />
        </div>
        </SkeletonShell>
    )
}
