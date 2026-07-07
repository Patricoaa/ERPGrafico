"use client"

import { useState, useMemo, useEffect } from "react"
import {
    getContactCreditLedger,
    writeOffDebt,
    writeOffSaleOrder,
    type CreditContact,
    type CreditLedgerEntry,
} from '@/features/credits/api/creditsApi'
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    RefreshCw, ShieldAlert, Gavel, ChevronDown, ChevronRight
} from "lucide-react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Button } from "@/components/ui/button"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { SkeletonShell, ActionConfirmModal, DataCell, EntityBadge, MoneyDisplay } from "@/components/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTable, type KpiCardDef } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
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

    const ledgerColumns = useMemo<ColumnDef<CreditLedgerEntry>[]>(() => [
        {
            id: "document",
            header: "N° Documento",
            cell: ({ row }) => <DataCell.Entity entityLabel="sales.saleorder" data={row.original as unknown as Record<string, unknown>} />
        },
        {
            id: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />
        },
        {
            id: "due_date",
            header: "Vencimiento",
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 w-full">
                    <DataCell.Date value={row.original.due_date} />
                    {row.original.days_overdue > 0 && (
                        <span className="text-destructive font-bold text-[11px]">({row.original.days_overdue}d)</span>
                    )}
                </div>
            )
        },
        {
            id: "total",
            header: "Total",
            meta: { align: "right" },
            cell: ({ row }) => <DataCell.Currency value={row.original.effective_total} />
        },
        {
            id: "paid",
            header: "Pagado",
            meta: { align: "right" },
            cell: ({ row }) => <DataCell.Currency value={row.original.paid_amount} className="text-success font-medium" />
        },
        {
            id: "balance",
            header: "Saldo",
            meta: { align: "right" },
            cell: ({ row }) => <DataCell.Currency value={row.original.balance} className="font-bold" />
        },
        {
            id: "origin",
            header: "Origen",
            cell: ({ row }) => row.original.credit_assignment_origin_display ? (
                <DataCell.Chip
                    intent={row.original.credit_assignment_origin === "MANUAL" ? "neutral" : row.original.credit_assignment_origin === "SALE" ? "info" : "warning"}
                    size="xs"
                    className="w-fit"
                >
                    {row.original.credit_assignment_origin_display}
                </DataCell.Chip>
            ) : <span className="text-muted-foreground/30">—</span>
        },
        {
            id: "status",
            header: "Estado",
            cell: ({ row }) => (
                <DataCell.Status
                    status={row.original.aging_bucket === 'current' ? 'SUCCESS' : (row.original.days_overdue > 60 ? 'ERROR' : 'WARNING')}
                    label={agingLabel[row.original.aging_bucket]}
                />
            )
        },
        {
            id: "actions",
            header: "",
            meta: { align: "right" },
            cell: ({ row }) => {
                const entry = row.original
                return (
                    <div className="flex justify-end gap-1">
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
                )
            }
        }
    ], [isDefault, writingOffDocId])

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
                <DataTable
                    variant="minimal"
                    columns={ledgerColumns}
                    data={ledger}
                />
            ) : (
                <p className="text-[12px] text-muted-foreground italic text-center py-4">Sin documentos pendientes.</p>
            )}

            <ActionConfirmModal
                open={!!showWriteOffDocDialog}
                onOpenChange={(o) => !o && setShowWriteOffDocDialog(null)}
                onConfirm={() => showWriteOffDocDialog ? handleWriteOffDoc(showWriteOffDocDialog.id) : undefined}
                title={`¿Castigar Documento ${formatEntityDisplay('sales.saleorder', { number: showWriteOffDocDialog?.number })}?`}
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
    segmentation,
    kpiCards,
}: {
    columns: ColumnDef<CreditContact>[],
    data: CreditContact[],
    isLoading: boolean,
    onRefresh: () => void,
    createAction?: React.ReactNode,
    smartSearch?: React.ReactNode,
    segmentation?: React.ReactNode,
    kpiCards?: KpiCardDef[],
}) {
    const columnsWithExpander = useMemo<ColumnDef<CreditContact>[]>(() => [
        {
            id: "expander",
            header: () => null,
            cell: ({ row }) => (
                <Button
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
                </Button>
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
                    segmentation={segmentation}
                    kpiCards={kpiCards}
                />
            </div>
        </div>
    )
}
