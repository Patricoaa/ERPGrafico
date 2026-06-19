"use client"

import { useState, useMemo, useEffect } from "react"
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
    RefreshCw, ShieldAlert, Gavel, ChevronDown, ChevronRight
} from "lucide-react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Button } from "@/components/ui/button"
import { SkeletonShell, ActionConfirmModal, DataCell, EntityBadge, MoneyDisplay } from "@/components/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTable } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { formatMoney } from "@/lib/money"

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
                    <Tooltip key={k}>
                        <TooltipTrigger asChild>
                            <div className={cn("h-full", colors[i])} style={{ width: `${pct}%` }} />
                        </TooltipTrigger>
                        <TooltipContent side="top">{agingLabel[k]}: <MoneyDisplay amount={aging[k]} inline /></TooltipContent>
                    </Tooltip>
                ) : null
            })}
        </div>
    )
}

function PortfolioContactPanel({ contact, onRefresh }: { contact: CreditContact, onRefresh: () => void }) {
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

    // Lazy load ledger on first expansion
    useEffect(() => {
        if (ledger === null && !loadingLedger) {
            requestAnimationFrame(() => {
                setLoadingLedger(true)
                getContactCreditLedger(contact.id)
                    .then(setLedger)
                    .catch(() => {
                        toast.error("Error al cargar historial de documentos")
                        setLedger([])
                    })
                    .finally(() => setLoadingLedger(false))
            })
        }
    }, [ledger, loadingLedger, contact.id])

    const handleWriteOff = async () => {
        setWritingOff(true)
        try {
            const res = await writeOffDebt(contact.id)
            toast.success(`Deuda castigada: ${res.journal_entry} por ${formatMoney(res.amount)}`)
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
            toast.success(`Documento castigado: ${res.journal_entry} por ${formatMoney(res.amount)}`)
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
        <>
            <div className="mb-6 flex items-center gap-4">
                <div className="flex-1">
                    <AgingBar aging={aging} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {agingBuckets.map((k) => (
                        Number(aging[k]) > 0 && (
                            <span key={k} className={cn("text-[11px] font-bold px-2.5 py-1 rounded-md border", agingBg[k])}>
                                {agingLabel[k]} <MoneyDisplay amount={aging[k]} inline />
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

            <ActionConfirmModal
                open={showWriteOffDialog}
                onOpenChange={setShowWriteOffDialog}
                onConfirm={handleWriteOff}
                title="¿Confirmar Castigo de Deuda?"
                description={
                    <div className="space-y-3 pt-1 text-sm leading-relaxed">
                        <p>Esta acción es <strong>irreversible</strong> y tiene las siguientes consecuencias:</p>
                        <ul className="list-disc list-inside space-y-1 font-medium text-muted-foreground">
                            <li>Se generará un asiento contable de pérdida por <span className="text-foreground font-bold"><MoneyDisplay amount={totalDebt} inline /></span>.</li>
                            <li>El cliente quedará bloqueado permanentemente.</li>
                            <li>La clasificación de riesgo pasará a <span className="text-destructive font-bold uppercase tracking-wider text-[10px]">Crítico</span>.</li>
                            <li>Se realizarán ajustes técnicos en tesorería para saldar los documentos pendientes.</li>
                        </ul>
                    </div>
                }
                variant="destructive"
                icon={ShieldAlert}
                confirmText="Confirmar Castigo"
            />

            {loadingLedger ? (
                <SkeletonShell isLoading ariaLabel="Cargando..." />
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
                                            className="mx-auto block hover:opacity-85 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openHub({ orderId: entry.id, type: 'sale' })
                                            }}
                                        >
                                            <EntityBadge label="sales.saleorder" data={{ id: entry.id, number: entry.number }} link={false} size="sm" />
                                        </button>
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <DataCell.Date value={entry.date} />
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <div className="flex justify-center items-center gap-1.5 w-full">
                                            <DataCell.Date value={entry.due_date} />
                                            {entry.days_overdue > 0 && (
                                                <span className="text-destructive font-bold text-[11px]">({entry.days_overdue}d)</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <DataCell.Currency value={entry.effective_total} />
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <DataCell.Currency value={entry.paid_amount} className="text-success font-medium" />
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <DataCell.Currency value={entry.balance} className="font-bold" />
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <div className="flex justify-center">
                                            {entry.credit_assignment_origin_display ? (
                                                <DataCell.Chip
                                                    intent={entry.credit_assignment_origin === "MANUAL" ? "neutral" : entry.credit_assignment_origin === "SALE" ? "info" : "warning"}
                                                    size="xs"
                                                    className="w-fit"
                                                >
                                                    {entry.credit_assignment_origin_display}
                                                </DataCell.Chip>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </div>
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        <DataCell.Status
                                            status={entry.aging_bucket === 'current' ? 'SUCCESS' : (entry.days_overdue > 60 ? 'ERROR' : 'WARNING')}
                                            label={agingLabel[entry.aging_bucket]}
                                        />
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

            <ActionConfirmModal
                open={!!showWriteOffDocDialog}
                onOpenChange={(o) => !o && setShowWriteOffDocDialog(null)}
                onConfirm={() => showWriteOffDocDialog ? handleWriteOffDoc(showWriteOffDocDialog.id) : undefined}
                title={`¿Castigar Documento NV-${showWriteOffDocDialog?.number}?`}
                description={
                    <div className="space-y-3 pt-1 text-sm leading-relaxed">
                        <p>Se castigará el saldo pendiente de <strong><MoneyDisplay amount={showWriteOffDocDialog?.balance} inline /></strong> para este documento.</p>
                    </div>
                }
                variant="destructive"
                icon={ShieldAlert}
                confirmText="Confirmar Castigo"
            />
        </>
    )
}

export function PortfolioTable({
    columns,
    data,
    isLoading,
    onRefresh,
    createAction,
    smartSearch,
}: {
    columns: ColumnDef<CreditContact>[],
    data: CreditContact[],
    isLoading: boolean,
    onRefresh: () => void,
    createAction?: React.ReactNode,
    smartSearch?: React.ReactNode,
}) {
    const columnsWithExpander = useMemo<ColumnDef<CreditContact>[]>(() => [
        {
            id: "expander",
            header: () => null,
            cell: ({ row }) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        row.toggleExpanded()
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                    {row.getIsExpanded() ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </button>
            ),
            size: 40,
            enableSorting: false,
            enableHiding: false,
        },
        ...columns,
    ], [columns])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columnsWithExpander}
                    data={data}
                    variant="embedded"
                    isLoading={isLoading}
                    renderSubComponent={(row) => (
                        <PortfolioContactPanel contact={row.original} onRefresh={onRefresh} />
                    )}
                    emptyState={{
                        context: "finance",
                        title: "No hay clientes con crédito",
                        description: "Habilite cupos de crédito para sus clientes para comenzar el seguimiento.",
                    }}
                    createAction={createAction}
                    smartSearch={smartSearch}
                />
            </div>
        </div>
    )
}
