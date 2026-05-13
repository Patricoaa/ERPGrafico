"use client"

import { useState, useCallback } from "react"
import { ExpandableTableRow } from "@/components/shared"
import {
    getContactCreditLedger,
    writeOffDebt,
    writeOffSaleOrder,
    CreditContact,
    CreditLedgerEntry,
} from '@/features/credits/api/creditsApi'
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    ChevronDown, ChevronRight,
    RefreshCw, ShieldAlert, Gavel
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
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/shared"
import { DataTable } from "@/components/ui/data-table"
import { type Table as ReactTable, type Row, type HeaderGroup, type Header, type Cell, flexRender, ColumnDef } from "@tanstack/react-table"
import { TableCell } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { StatusBadge } from "@/components/shared/StatusBadge"

const fmt = (v: string | number | undefined) =>
    Number(v || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

const agingLabel: Record<string, string> = {
    current: "Al día",
    overdue_30: "1-30 días",
    overdue_60: "31-60 días",
    overdue_90: "61-90 días",
    overdue_90plus: "+90 días"
}

const agingBg: Record<string, string> = {
    current: "bg-success/5 text-success border-success/20",
    overdue_30: "bg-warning/5 text-warning border-warning/20",
    overdue_60: "bg-warning/10 text-warning border-warning/30",
    overdue_90: "bg-destructive/5 text-destructive border-destructive/20",
    overdue_90plus: "bg-destructive/10 text-destructive border-destructive/30"
}

const originBg: Record<string, string> = {
    MANUAL: "bg-muted text-muted-foreground border-border",
    SALE: "bg-info/5 text-info border-info/20",
    ADJUSTMENT: "bg-warning/5 text-warning border-warning/20",
    REVERSAL: "bg-destructive/5 text-destructive border-destructive/20"
}

function AgingBar({ aging }: { aging: CreditContact["credit_aging"] }) {
    const total = Object.values(aging).reduce((a, b) => a + Number(b), 0)
    if (total === 0) return <span className="text-[11px] text-muted-foreground">Sin saldo</span>
    const keys = ["current", "overdue_30", "overdue_60", "overdue_90", "overdue_90plus"] as const
    const colors = ["bg-success", "bg-warning", "bg-warning/50", "bg-destructive", "bg-destructive/80 font-black"]
    return (
        <div className="flex h-2 w-full rounded-full overflow-hidden gap-px bg-muted">
            {keys.map((k, i) => {
                const pct = (Number(aging[k]) / total) * 100
                return pct > 0 ? (
                    <div key={k} className={cn("h-full", colors[i])} style={{ width: `${pct}%` }} title={`${agingLabel[k]}: ${fmt(aging[k])}`} />
                ) : null
            })}
        </div>
    )
}

function ExpandableContactRow({ row, onRefresh }: { row: Row<CreditContact>, onRefresh: () => void }) {
    const contact = row.original
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [loadingLedger, setLoadingLedger] = useState(false)
    const [writingOff, setWritingOff] = useState(false)
    const [showWriteOffDialog, setShowWriteOffDialog] = useState(false)
    const { openHub } = useHubPanel()

    const totalDebt = Number(contact.credit_balance_used)
    const aging = contact.credit_aging
    const isDefault = contact.is_default_customer
    const [writingOffDocId, setWritingOffDocId] = useState<number | null>(null)
    const [showWriteOffDocDialog, setShowWriteOffDocDialog] = useState<{ id: number, number: string, balance: number } | null>(null)

    const handleWriteOff = async () => {
        setWritingOff(true)
        try {
            const res = await writeOffDebt(contact.id)
            toast.success(`Deuda castigada: ${res.journal_entry} por ${fmt(res.amount)}`)
            onRefresh()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } }; message?: string }
            const errorMsg = e.response?.data?.error || e.message || "Error al castigar deuda"
            toast.error(errorMsg)
        } finally {
            setWritingOff(false)
        }
    }

    const handleWriteOffDoc = async (saleOrderId: number) => {
        setWritingOffDocId(saleOrderId)
        try {
            const res = await writeOffSaleOrder(saleOrderId)
            toast.success(`Documento castigado: ${res.journal_entry} por ${fmt(res.amount)}`)
            setLedger(null)
            onRefresh()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } }; message?: string }
            const errorMsg = e.response?.data?.error || e.message || "Error al castigar documento"
            toast.error(errorMsg)
        } finally {
            setWritingOffDocId(null)
            setShowWriteOffDocDialog(null)
        }
    }

    const agingBuckets = ['current', 'overdue_30', 'overdue_60', 'overdue_90', 'overdue_90plus'] as const;

    return (
        <ExpandableTableRow
            row={row}
            onExpand={async (isExpanding) => {
                if (isExpanding && !ledger) {
                    setLoadingLedger(true)
                    try {
                        const data = await getContactCreditLedger(contact.id)
                        setLedger(data)
                    } catch (error) {
                        console.error("Error fetching credit ledger:", error)
                        toast.error("Error al cargar historial de documentos")
                        setLedger([])
                    } finally {
                        setLoadingLedger(false)
                    }
                }
            }}
        >
            <div className="mb-6 flex items-center gap-4">
                <div className="flex-1">
                    <AgingBar aging={aging} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {agingBuckets.map((k) => (
                        Number(aging[k]) > 0 && (
                            <span key={k} className={cn("text-[11px] font-bold px-2.5 py-1 rounded-md border", agingBg[k])}>
                                {agingLabel[k]} {fmt(aging[k])}
                            </span>
                        )
                    ))}
                    {totalDebt > 0 && !isDefault && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                            disabled={writingOff}
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowWriteOffDialog(true)
                            }}
                        >
                            <Gavel className="h-3.5 w-3.5" />
                            Castigar Deuda
                        </Button>
                    )}
                </div>
            </div>

            <AlertDialog open={showWriteOffDialog} onOpenChange={setShowWriteOffDialog}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <ShieldAlert className="h-6 w-6" />
                        <AlertDialogTitle className="text-xl font-black">¿Confirmar Castigo de Deuda?</AlertDialogTitle>
                        <div className="space-y-3 pt-2">
                            <AlertDialogDescription>
                                Esta acción es **irreversible** y tiene las siguientes consecuencias:
                            </AlertDialogDescription>
                            <ul className="list-disc list-inside space-y-1 text-sm font-medium text-muted-foreground">
                                <li>Se generará un asiento contable de pérdida por <span className="text-foreground font-bold">{fmt(totalDebt)}</span>.</li>
                                <li>El cliente quedará bloqueado permanentemente.</li>
                                <li>La clasificación de riesgo pasará a <span className="text-destructive font-bold uppercase tracking-wider text-[10px]">Crítico</span>.</li>
                                <li>Se realizarán ajustes técnicos en tesorería para saldar los documentos pendientes.</li>
                            </ul>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-white font-bold"
                            onClick={handleWriteOff}
                        >
                            Confirmar Castigo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {loadingLedger ? (
                <TableSkeleton rows={2} />
            ) : ledger && ledger.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">
                                <th className="pb-2 pr-4 text-center">N° Documento</th>
                                <th className="pb-2 pr-4 text-center">Fecha</th>
                                <th className="pb-2 pr-4 text-center">Vencimiento</th>
                                <th className="pb-2 pr-4 text-center">Total</th>
                                <th className="pb-2 pr-4 text-center">Pagado</th>
                                <th className="pb-2 pr-4 text-center">Saldo</th>
                                <th className="pb-2 pr-4 text-center">Origen</th>
                                <th className="pb-2 pr-4 text-center">Estado</th>
                                <th className="pb-2 pr-2 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {ledger.map((entry) => (
                                <tr key={entry.id} className="text-[12px] group">
                                    <td className="py-2 pr-4 text-center">
                                        <button
                                            className="font-bold text-primary hover:underline flex items-center justify-center gap-1 mx-auto"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openHub({ orderId: entry.id, type: 'sale' })
                                            }}
                                        >
                                            NV-{entry.number}
                                        </button>
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground text-center">{entry.date}</td>
                                    <td className="py-2 pr-4 text-muted-foreground text-center">
                                        {entry.due_date}
                                        {entry.days_overdue > 0 && (
                                            <span className="ml-1 text-destructive font-bold">({entry.days_overdue}d)</span>
                                        )}
                                    </td>
                                    <td className="py-2 pr-4 text-center font-mono">{fmt(entry.effective_total)}</td>
                                    <td className="py-2 pr-4 text-center font-mono text-success font-medium">{fmt(entry.paid_amount)}</td>
                                    <td className="py-2 pr-4 text-center font-mono font-bold">{fmt(entry.balance)}</td>
                                    <td className="py-2 pr-4 text-center">
                                        <div className="flex justify-center">
                                            {entry.credit_assignment_origin_display ? (
                                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap", originBg[entry.credit_assignment_origin || ""])}>
                                                    {entry.credit_assignment_origin_display}
                                                </span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </div>
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <div className="flex justify-center">
                                            <StatusBadge
                                                variant="default"
                                                status={entry.aging_bucket === 'current' ? 'SUCCESS' : (entry.days_overdue > 60 ? 'ERROR' : 'WARNING')}
                                                label={agingLabel[entry.aging_bucket]}
                                            />
                                        </div>
                                    </td>
                                    <td className="py-2 pr-2 text-center">
                                        <div className="flex justify-center gap-1">
                                            {isDefault && Number(entry.balance) > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10 gap-1"
                                                    disabled={writingOffDocId === entry.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setShowWriteOffDocDialog({ id: entry.id, number: entry.number, balance: Number(entry.balance) })
                                                    }}
                                                >
                                                    {writingOffDocId === entry.id
                                                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                                                        : <Gavel className="h-3 w-3" />}
                                                    Castigar
                                                </Button>
                                            )}
                                            {!isDefault && <span className="text-muted-foreground/30">—</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-[12px] text-muted-foreground italic text-center py-4">Sin documentos pendientes.</p>
            )}

            <AlertDialog open={!!showWriteOffDocDialog} onOpenChange={(o) => !o && setShowWriteOffDocDialog(null)}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <ShieldAlert className="h-6 w-6" />
                        <AlertDialogTitle className="text-xl font-black">¿Castigar Documento NV-{showWriteOffDocDialog?.number}?</AlertDialogTitle>
                        <div className="space-y-3 pt-2">
                            <AlertDialogDescription>
                                Se castigará el saldo pendiente de <strong>{fmt(showWriteOffDocDialog?.balance)}</strong> para este documento.
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-white font-bold"
                            onClick={() => showWriteOffDocDialog && handleWriteOffDoc(showWriteOffDocDialog.id)}
                        >
                            Confirmar Castigo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ExpandableTableRow>
    )
}

export function PortfolioTable({
    columns,
    data,
    isLoading,
    onRefresh,
    createAction
}: {
    columns: ColumnDef<CreditContact>[],
    data: CreditContact[],
    isLoading: boolean,
    onRefresh: () => void,
    createAction?: React.ReactNode
}) {
    const renderPortfolioCustomView = useCallback((table: ReactTable<CreditContact>) => {
        const rows = table.getRowModel().rows
        if (rows.length === 0 && !isLoading) {
            return (
                <EmptyState
                    context="finance"
                    title="No hay clientes con crédito"
                    description="Habilite cupos de crédito para sus clientes para comenzar el seguimiento."
                />
            )
        }
        return (
            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left">
                    <thead className="border-b border-border/50">
                        {table.getHeaderGroups().map((headerGroup: HeaderGroup<CreditContact>) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header: Header<CreditContact, unknown>) => (
                                    <th key={header.id} className="px-4 py-3 text-muted-foreground font-black text-[10px] uppercase tracking-widest whitespace-nowrap text-center">
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                                <th className="px-3 py-3 w-12" />
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {table.getRowModel().rows.map((row: Row<CreditContact>) => (
                            <ExpandableContactRow key={row.id} row={row} onRefresh={onRefresh} />
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }, [isLoading, onRefresh])

    return (
        <DataTable
            columns={columns}
            data={data}
            variant="embedded"
            isLoading={isLoading}
            useAdvancedFilter
            globalFilterFields={["name", "tax_id"]}
            searchPlaceholder="Buscar cliente..."
            renderCustomView={renderPortfolioCustomView}
            createAction={createAction}
        />
    )
}
