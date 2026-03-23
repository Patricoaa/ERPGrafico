"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getCreditPortfolio, getContactCreditLedger, getGlobalCreditHistory, writeOffDebt, writeOffSaleOrder, CreditContact, CreditPortfolioResponse, CreditLedgerEntry, CreditHistoryEntry } from "@/lib/credits/api"
import { toast } from "sonner"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { cn } from "@/lib/utils"
import {
    AlertCircle, CreditCard, TrendingUp, Users, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle2, Ban, RefreshCw, Clock, ShieldAlert,
    Target, BarChart3, PieChart, Activity, Gavel, HelpCircle, Plus
} from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import CreditAssignmentModal from "./components/CreditAssignmentModal"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { flexRender } from "@tanstack/react-table"
import { TableRow, TableCell } from "@/components/ui/table"

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: string | number | undefined) =>
    Number(v || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

const agingLabel: Record<string, string> = {
    current: "Corriente",
    overdue_30: "1–30 días",
    overdue_60: "31–60 días",
    overdue_90: "61–90 días",
    overdue_90plus: "+90 días",
}

const agingColor: Record<string, string> = {
    current: "text-emerald-500",
    overdue_30: "text-amber-500",
    overdue_60: "text-orange-500",
    overdue_90: "text-rose-500",
    overdue_90plus: "text-rose-700",
}

const agingBg: Record<string, string> = {
    current: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    overdue_30: "bg-amber-500/10 text-amber-700 border-amber-200",
    overdue_60: "bg-orange-500/10 text-orange-700 border-orange-200",
    overdue_90: "bg-rose-500/10 text-rose-700 border-rose-200",
    overdue_90plus: "bg-rose-700/10 text-rose-900 border-rose-300",
}

const riskLabel: Record<string, string> = {
    LOW: "Riesgo Bajo",
    MEDIUM: "Riesgo Medio",
    HIGH: "Riesgo Alto",
    CRITICAL: "Riesgo Crítico",
}

const riskColor: Record<string, string> = {
    LOW: "bg-emerald-500",
    MEDIUM: "bg-amber-500",
    HIGH: "bg-orange-500",
    CRITICAL: "bg-rose-600",
}

const riskBg: Record<string, string> = {
    LOW: "bg-emerald-50/50 text-emerald-700 border-emerald-100",
    MEDIUM: "bg-amber-50/50 text-amber-700 border-amber-100",
    HIGH: "bg-orange-50/50 text-orange-700 border-orange-100",
    CRITICAL: "bg-rose-50/50 text-rose-700 border-rose-100",
}

const originBg: Record<string, string> = {
    MANUAL: "bg-blue-500/10 text-blue-700 border-blue-200",
    FALLBACK: "bg-amber-500/10 text-amber-700 border-amber-200",
    CREDIT_PORTFOLIO: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
    label: string
    value: string | number
    sub?: string
    icon: React.ElementType
    color: string
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "rounded-2xl border bg-card p-5 flex flex-col gap-3 shadow-sm relative overflow-hidden",
            )}
        >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                <Icon className="w-12 h-12" />
            </div>
            <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                <div className={cn("p-2 rounded-xl", color)}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="text-2xl font-black font-heading tracking-tight relative z-10">{value}</div>
            {sub && <p className="text-[11px] text-muted-foreground font-medium relative z-10">{sub}</p>}
        </motion.div>
    )
}

function AgingBar({ aging }: { aging: CreditContact["credit_aging"] }) {
    const total = Object.values(aging).reduce((a, b) => a + Number(b), 0)
    if (total === 0) return <span className="text-[11px] text-muted-foreground">Sin saldo</span>
    const keys = ["current", "overdue_30", "overdue_60", "overdue_90", "overdue_90plus"] as const
    const colors = ["bg-emerald-400", "bg-amber-400", "bg-orange-400", "bg-rose-400", "bg-rose-700"]
    return (
        <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
            {keys.map((k, i) => {
                const pct = (Number(aging[k]) / total) * 100
                return pct > 0 ? (
                    <div key={k} className={cn("h-full", colors[i])} style={{ width: `${pct}%` }} title={`${agingLabel[k]}: ${fmt(aging[k])}`} />
                ) : null
            })}
        </div>
    )
}

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
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"

function ContactRow({ contact, onRefresh }: { contact: CreditContact, onRefresh: () => void }) { }

// Helper hook or component for expandable DataTable rows
function ExpandableContactRow({ row, onRefresh }: { row: any, onRefresh: () => void }) {
    const contact = row.original as CreditContact
    const [expanded, setExpanded] = useState(false)
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [loadingLedger, setLoadingLedger] = useState(false)
    const [writingOff, setWritingOff] = useState(false)
    const [showWriteOffDialog, setShowWriteOffDialog] = useState(false)
    const [selectedDocForHub, setSelectedDocForHub] = useState<number | null>(null)

    const totalDebt = Number(contact.credit_balance_used)
    const aging = contact.credit_aging
    const isDefault = contact.is_default_customer
    const [writingOffDocId, setWritingOffDocId] = useState<number | null>(null)
    const [showWriteOffDocDialog, setShowWriteOffDocDialog] = useState<{ id: number, number: string, balance: number } | null>(null)

    const handleExpand = useCallback(async () => {
        const next = !expanded
        setExpanded(next)
        if (next && !ledger) {
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
    }, [expanded, ledger, contact.id])

    const handleWriteOff = async () => {
        setWritingOff(true)
        try {
            const res = await writeOffDebt(contact.id)
            toast.success(`Deuda castigada: ${res.journal_entry} por ${fmt(res.amount)}`)
            onRefresh()
        } catch (e: any) {
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
        } catch (e: any) {
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
            <TableRow
                className={cn(
                    "cursor-pointer hover:bg-muted/30 transition-colors text-sm",
                    expanded && "bg-muted/20"
                )}
                onClick={handleExpand}
                data-state={row.getIsSelected() && "selected"}
            >
                {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id} className="py-3 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                ))}
                <TableCell className="px-3 py-3 text-muted-foreground w-12 cursor-pointer text-center">
                    {expanded ? <ChevronDown className="h-4 w-4 mx-auto" /> : <ChevronRight className="h-4 w-4 mx-auto" />}
                </TableCell>
            </TableRow>

            <AnimatePresence>
                {expanded && (
                    <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={row.getVisibleCells().length + 1} className="p-0 border-b">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-background border-b border-border/50"
                            >
                                <div className="px-8 py-4 bg-background">
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
                                                    className="h-8 gap-2 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-200"
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
                                                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600">
                                                    <ShieldAlert className="h-6 w-6" />
                                                </div>
                                                <AlertDialogTitle className="text-xl font-black">¿Confirmar Castigo de Deuda?</AlertDialogTitle>
                                                <div className="space-y-3 pt-2">
                                                    <AlertDialogDescription>
                                                        Esta acción es **irreversible** y tiene las siguientes consecuencias:
                                                    </AlertDialogDescription>
                                                    <ul className="list-disc list-inside space-y-1 text-sm font-medium text-muted-foreground">
                                                        <li>Se generará un asiento contable de pérdida por <span className="text-foreground font-bold">{fmt(totalDebt)}</span>.</li>
                                                        <li>El cliente quedará bloqueado permanentemente.</li>
                                                        <li>La clasificación de riesgo pasará a <span className="text-rose-600 font-bold uppercase tracking-wider text-[10px]">Crítico</span>.</li>
                                                        <li>Se realizarán ajustes técnicos en tesorería para saldar los documentos pendientes.</li>
                                                    </ul>
                                                    <p className="text-xs text-muted-foreground pt-2 italic">
                                                        Use esta opción únicamente cuando la deuda se considere incobrable tras agotar las instancias de cobro.
                                                    </p>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-2 mt-4">
                                                <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                                                    onClick={handleWriteOff}
                                                >
                                                    Confirmar Castigo
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>

                                    {loadingLedger ? (
                                        <div className="space-y-2">
                                            {[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                                        </div>
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
                                                        <th className="pb-2 pr-4">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span>Origen</span>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="p-2 text-[10px] max-w-[180px]">
                                                                            Indica la fuente de la asignación de crédito para este documento específico.
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                        </th>
                                                        <th className="pb-2 pr-4">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span>Estado</span>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="p-2 text-[10px] max-w-[180px]">
                                                                            Vigencia del documento basada en la fecha de vencimiento.
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                        </th>
                                                        {isDefault && <th className="pb-2 pr-2 text-center">Castigo</th>}
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
                                                                        setSelectedDocForHub(entry.id)
                                                                    }}
                                                                >
                                                                    NV-{entry.number}
                                                                </button>
                                                            </td>
                                                            <td className="py-2 pr-4 text-muted-foreground text-center">{entry.date}</td>
                                                            <td className="py-2 pr-4 text-muted-foreground text-center">
                                                                {entry.due_date}
                                                                {entry.days_overdue > 0 && (
                                                                    <span className="ml-1 text-rose-500 font-bold">({entry.days_overdue}d)</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 pr-4 text-center font-mono">{fmt(entry.effective_total)}</td>
                                                            <td className="py-2 pr-4 text-center font-mono text-emerald-600">{fmt(entry.paid_amount)}</td>
                                                            <td className="py-2 pr-4 text-center font-mono font-bold">{fmt(entry.balance)}</td>
                                                            <td className="py-2 pr-4 text-center">
                                                                <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="cursor-help flex justify-center">{entry.credit_assignment_origin_display ? (
                                                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap", originBg[entry.credit_assignment_origin || ""])}>
                                                                        {entry.credit_assignment_origin_display}
                                                                    </span>
                                                                ) : <span className="text-muted-foreground/30">—</span>}</div></TooltipTrigger><TooltipContent className="p-2 text-[10px]">{entry.credit_assignment_origin === 'MANUAL' && "Asignado manualmente por un supervisor."}{entry.credit_assignment_origin === 'FALLBACK' && "Asignación temporal automática (Fallback)."}{entry.credit_assignment_origin === 'CREDIT_PORTFOLIO' && "Cupo oficial definido en la cartera de crédito."}{!entry.credit_assignment_origin && "Origen no especificado."}</TooltipContent></Tooltip></TooltipProvider>
                                                            </td>
                                                            <td className="py-2 pr-4 text-center">
                                                                <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex justify-center"><span className={cn("text-[10px] items-center gap-1.5 font-bold px-2 py-0.5 rounded border inline-flex cursor-help", agingBg[entry.aging_bucket])}>
                                                                    {entry.aging_bucket === 'current' ? <CheckCircle2 className="h-3.5 w-3.5" /> : (entry.days_overdue > 60 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />)}
                                                                    {agingLabel[entry.aging_bucket]}
                                                                </span></div>
                                                                </TooltipTrigger>
                                                                    <TooltipContent className="p-2 text-[10px]">
                                                                        {entry.aging_bucket === 'current' && "Documento vigente y pagado dentro de plazo."}
                                                                        {entry.aging_bucket !== 'current' && `Documento con ${entry.days_overdue} días de atraso.`}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                </TooltipProvider>
                                                            </td>
                                                            {isDefault && (
                                                                <td className="py-2 pr-2 text-center">
                                                                    {Number(entry.balance) > 0 && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 px-2 text-[10px] text-rose-600 hover:bg-rose-50 gap-1"
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
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-[12px] text-muted-foreground italic">Sin documentos pendientes.</p>
                                    )}

                                    <OrderCommandCenter
                                        open={!!selectedDocForHub}
                                        onOpenChange={(o) => !o && setSelectedDocForHub(null)}
                                        orderId={selectedDocForHub}
                                        type="sale"
                                        onActionSuccess={() => {
                                            setLedger(null)
                                            handleExpand()
                                            onRefresh()
                                        }}
                                    />

                                    {/* Per-document write-off confirmation dialog (default customer only) */}
                                    <AlertDialog open={!!showWriteOffDocDialog} onOpenChange={(o) => !o && setShowWriteOffDocDialog(null)}>
                                        <AlertDialogContent className="max-w-md">
                                            <AlertDialogHeader>
                                                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600">
                                                    <ShieldAlert className="h-6 w-6" />
                                                </div>
                                                <AlertDialogTitle className="text-xl font-black">¿Castigar Documento NV-{showWriteOffDocDialog?.number}?</AlertDialogTitle>
                                                <div className="space-y-3 pt-2">
                                                    <AlertDialogDescription>
                                                        Se castigará el saldo pendiente de <strong>{fmt(showWriteOffDocDialog?.balance)}</strong> para este documento.
                                                    </AlertDialogDescription>
                                                    <ul className="list-disc list-inside space-y-1 text-sm font-medium text-muted-foreground">
                                                        <li>Se generará un asiento contable de pérdida.</li>
                                                        <li>El documento quedará saldado contablemente.</li>
                                                        <li>Esta acción es <strong>irreversible</strong>.</li>
                                                    </ul>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-2 mt-4">
                                                <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                                                    onClick={() => showWriteOffDocDialog && handleWriteOffDoc(showWriteOffDocDialog.id)}
                                                >
                                                    Confirmar Castigo
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </motion.div>
                        </TableCell>
                    </TableRow>
                )}
            </AnimatePresence>
        </>
    )
}

// ─── Column Definitions ──────────────────────────────────────────────────────

const portfolioColumns: ColumnDef<CreditContact>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
        cell: ({ row }) => {
            const contact = row.original
            return (
                <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                        <div className="font-semibold text-[13px] leading-tight flex items-center justify-center gap-2">
                            {contact.name}
                            {contact.credit_auto_blocked && <AlertCircle className="h-3 w-3 text-orange-500" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">{contact.display_id} · {contact.tax_id}</div>
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "credit_risk_level",
        header: ({ column }) => (
            <div className="flex items-center justify-center gap-1">
                <DataTableColumnHeader column={column} title="Riesgo" className="justify-center" />
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[250px] space-y-2 p-3">
                            <p className="font-bold text-xs border-b pb-1">Niveles de Riesgo:</p>
                            <div className="space-y-1.5">
                                <p className="text-[10px] leading-relaxed"><span className="font-bold text-emerald-600">Bajo:</span> Excelente historial, sin moras recientes.</p>
                                <p className="text-[10px] leading-relaxed"><span className="font-bold text-blue-600">Medio:</span> Comportamiento estable con atrasos esporádicos.</p>
                                <p className="text-[10px] leading-relaxed"><span className="font-bold text-orange-600">Alto:</span> Frecuentes atrasos o sobregiros de límite.</p>
                                <p className="text-[10px] leading-relaxed"><span className="font-bold text-rose-600">Crítico:</span> Deuda vencida prolongada o riesgo financiero inminente.</p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        ),
        accessorFn: (row) => riskLabel[row.credit_risk_level],
        filterFn: (row, id, value: string[]) => {
            if (!value || value.length === 0) return true
            return value.includes(row.getValue(id))
        },
        cell: ({ row }) => {
            const contact = row.original
            const hasOverdue = Number(contact.credit_aging.overdue_30) + Number(contact.credit_aging.overdue_60) + Number(contact.credit_aging.overdue_90) + Number(contact.credit_aging.overdue_90plus) > 0
            const statusLabel = row.original.credit_blocked ? "Bloqueado" : row.original.credit_auto_blocked ? "Auto-Bloqueo" : hasOverdue ? "En mora" : Number(contact.credit_balance_used) > 0 ? "Activo" : "Al día"

            let lvl = contact.credit_risk_level

            // Safeguard: "Al día" clients should not show CRITICAL risk even if suggested by backend (stale levels)
            if (statusLabel === "Al día" && lvl === 'CRITICAL') {
                lvl = 'LOW'
            }

            return (
                <div className={cn("flex flex-col items-center px-2 py-0.5 rounded-md border w-fit mx-auto", riskBg[lvl])}>
                    <span className="text-[10px] font-bold leading-tight whitespace-nowrap">{riskLabel[lvl]}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "credit_limit",
        header: ({ column }) => (
            <div className="flex items-center justify-center gap-1">
                <DataTableColumnHeader column={column} title="Límite" className="justify-center" />
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] p-3">
                            <div className="space-y-2">
                                <p className="text-[10px] leading-relaxed"><span className="font-bold">Límite Asignado:</span> Cupo máximo definido en la ficha comercial del cliente.</p>
                                <p className="text-[10px] leading-relaxed"><span className="font-bold text-amber-600">Pre-aprobado (% venta):</span> Límite temporal autogenerado cuando existe deuda pero no hay cupo oficial asignado.</p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        ),
        cell: ({ row, table }) => {
            const contact = row.original
            const limit = Number(contact.credit_limit || 0)
            const balance = Number(contact.credit_balance_used)

            // Fallback logic: if no limit but has debt (likely fallback authorized)
            const isFallback = limit === 0 && balance > 0

            // Extract the setter from table meta (we'll add this later)
            const onEdit = (table.options.meta as any)?.onEditLimit

            return (
                <div
                    className={cn(
                        "text-center flex flex-col items-center cursor-pointer group hover:bg-muted/50 rounded-lg p-1 transition-colors",
                        onEdit ? "cursor-pointer" : "cursor-default"
                    )}
                    onClick={() => onEdit?.(contact)}
                >
                    <span className={cn(
                        "text-[12px] font-mono group-hover:underline",
                        isFallback ? "text-amber-600 font-bold" : "text-muted-foreground",
                        !isFallback && limit > 0 && "text-primary font-bold"
                    )}>
                        {isFallback ? fmt(balance) : (limit > 0 ? fmt(limit) : <span className="text-muted-foreground/40">—</span>)}
                    </span>
                    {isFallback && <span className="text-[8px] font-black uppercase tracking-tighter text-amber-500 opacity-60">Pre-aprobado (% venta)</span>}
                </div>
            )
        },
    },
    {
        accessorKey: "credit_balance_used",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Utilizado" className="justify-center" />,
        cell: ({ row }) => {
            const val = Number(row.original.credit_balance_used)
            return <div className="text-center font-mono font-bold text-[13px]">{val > 0 ? fmt(val) : <span className="text-muted-foreground/40">—</span>}</div>
        },
    },
    {
        id: "current",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Deuda" className="justify-center text-emerald-600" />,
        cell: ({ row }) => {
            const val = Number(row.original.credit_aging.current)
            return <div className={cn("text-center text-[12px] font-mono", agingColor.current)}>{val > 0 ? fmt(val) : <span className="text-muted-foreground/30">—</span>}</div>
        },
    },
    {
        id: "overdue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="En Mora" className="justify-center text-rose-600" />,
        cell: ({ row }) => {
            const aging = row.original.credit_aging
            const val = Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus)
            return <div className={cn("text-center text-[12px] font-mono", val > 0 ? "text-rose-600 font-bold" : "")}>{val > 0 ? fmt(val) : <span className="text-muted-foreground/30">—</span>}</div>
        },
    },
    {
        id: "status",
        header: ({ column }) => (
            <div className="flex items-center justify-center gap-1">
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            </div>
        ),
        accessorFn: (row) => {
            const hasOverdue = Number(row.credit_aging.overdue_30) + Number(row.credit_aging.overdue_60) + Number(row.credit_aging.overdue_90) + Number(row.credit_aging.overdue_90plus) > 0
            if (row.credit_blocked) return "Bloqueado"
            if (row.credit_auto_blocked) return "Auto-Bloqueo"
            if (hasOverdue) return "En mora"
            if (Number(row.credit_balance_used) > 0) return "Activo"
            return "Al día"
        },
        filterFn: (row, id, value: string[]) => {
            if (!value || value.length === 0) return true
            return value.includes(row.getValue(id))
        },
        cell: ({ row }) => {
            const contact = row.original
            const totalDebt = Number(contact.credit_balance_used)
            const aging = contact.credit_aging
            const hasOverdue = Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus) > 0

            const statusBadge = contact.credit_blocked
                ? { label: "Bloqueado", cls: "bg-rose-100 text-rose-700 border-rose-200" }
                : contact.credit_auto_blocked
                    ? { label: "Auto-Bloqueo", cls: "bg-orange-100 text-orange-700 border-orange-200" }
                    : hasOverdue
                        ? { label: "En mora", cls: "bg-amber-100 text-amber-700 border-amber-200" }
                        : totalDebt > 0
                            ? { label: "Activo", cls: "bg-blue-100 text-blue-700 border-blue-200" }
                            : { label: "Al día", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }

            return (
                <div className="flex justify-center">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border", statusBadge.cls)}>
                        {statusBadge.label}
                    </span>
                </div>
            )
        },
    },
]

const historyColumns: ColumnDef<CreditHistoryEntry>[] = [
    {
        accessorKey: "date",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha/Hora" className="justify-center" />,
        cell: ({ row }) => {
            const entry = row.original
            return (
                <div className="text-center">
                    <div className="text-[13px] font-semibold">{new Date(entry.date).toLocaleDateString()}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            )
        }
    },
    {
        accessorKey: "customer_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
        cell: ({ row }) => {
            const entry = row.original
            return (
                <div className="text-center">
                    <div className="font-bold text-[13px] leading-tight text-foreground">{entry.customer_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{entry.display_id}</div>
                </div>
            )
        }
    },
    {
        accessorKey: "number",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Documento" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <Badge variant="outline" className="font-mono text-[11px] bg-background">{row.getValue("number")}</Badge>
            </div>
        )
    },
    {
        accessorKey: "effective_total",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Monto Original" className="justify-center" />,
        cell: ({ row }) => <div className="text-center font-mono font-bold text-[13px]">{fmt(row.getValue("effective_total"))}</div>
    },
    {
        accessorKey: "credit_assignment_origin",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Origen" className="justify-center" />,
        filterFn: (row, id, value: string[]) => {
            if (!value || value.length === 0) return true
            return value.includes(row.getValue(id))
        },
        cell: ({ row }) => {
            const entry = row.original
            return (
                <div className="flex justify-center">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border shadow-sm", originBg[entry.credit_assignment_origin] || "bg-muted text-muted-foreground")}>
                        {entry.credit_assignment_origin_display}
                    </span>
                </div>
            )
        }
    },
    {
        id: "approval",
        header: () => <div className="text-center">Aprobación / Detalles</div>,
        cell: ({ row }) => {
            const entry = row.original
            return entry.credit_approval_task_details ? (
                <div className="space-y-1 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 w-fit mx-auto">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aprobado por {entry.credit_approval_task_details.completed_by_name}
                    </div>
                    <div className="text-[10px] text-emerald-600/70 font-medium flex items-center gap-1 justify-center">
                        <Clock className="h-2.5 w-2.5" />
                        {entry.credit_approval_task_details.completed_at && new Date(entry.credit_approval_task_details.completed_at).toLocaleString()}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic font-medium w-fit mx-auto justify-center">
                    <Activity className="h-3.5 w-3.5 opacity-50" />
                    Asignación Automática
                </div>
            )
        }
    }
]

// ─── Credit History Table ──────────────────────────────────────────────────

function CreditHistoryTable({ history, loading }: { history: CreditHistoryEntry[] | null, loading: boolean }) {
    if (loading) return (
        <div className="rounded-2xl border bg-card/50 p-24 flex flex-col items-center justify-center gap-4 border-dashed">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-medium">Cargando historial de creditos concedidos...</p>
        </div>
    )

    if (!history || history.length === 0) return (
        <div className="rounded-2xl border bg-card/50 p-24 text-center border-dashed">
            <p className="text-muted-foreground italic font-medium">No se han registrado asignaciones de crédito aún.</p>
        </div>
    )

    return (
        <DataTable
            columns={historyColumns}
            data={history}
            cardMode
            useAdvancedFilter
            showToolbarSort={false}
            globalFilterFields={["customer_name", "display_id", "number"]}
            searchPlaceholder="Buscar por cliente, rut o documento..."
            facetedFilters={[
                {
                    column: "credit_assignment_origin",
                    title: "Origen",
                    options: [
                        { label: "Manual", value: "MANUAL" },
                        { label: "Fallback Automático", value: "FALLBACK" },
                        { label: "Cartera de Crédito", value: "CREDIT_PORTFOLIO" },
                    ]
                }
            ]}
        />
    )
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function CreditPortfolioView({ activeTab = 'portfolio' }: { activeTab?: 'portfolio' | 'history' }) {
    const [data, setData] = useState<CreditPortfolioResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [history, setHistory] = useState<CreditHistoryEntry[] | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Assignment Modal State
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<CreditContact | null>(null)

    const handleAssign = () => {
        setEditingContact(null)
        setAssignmentModalOpen(true)
    }

    const handleEditLimit = (contact: CreditContact) => {
        setEditingContact(contact)
        setAssignmentModalOpen(true)
    }

    useEffect(() => {
        if (activeTab === 'history' && !history) {
            setLoadingHistory(true)
            getGlobalCreditHistory()
                .then(setHistory)
                .catch(e => toast.error("Error cargando historial"))
                .finally(() => setLoadingHistory(false))
        }
    }, [activeTab, history])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await getCreditPortfolio()
            setData(result)
        } catch (e: any) {
            setError(e.message || "Error cargando datos")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const s = data?.summary
    const totalDebt = Number(s?.total_debt || 0)
    const utilizationRate = Number(s?.utilization_rate || 0)
    const potentialLoss = Number(s?.potential_loss || 0)
    const totalOverdue = Number(s?.overdue_30 || 0) + Number(s?.overdue_60 || 0) + Number(s?.overdue_90 || 0) + Number(s?.overdue_90plus || 0)

    const contacts = data?.contacts || []

    // Consistency: Calculate Total Exposure and Utilization including Fallback Credit
    const computedTotalLimit = contacts.reduce((acc, c) => {
        const limit = Number(c.credit_limit || 0)
        const balance = Number(c.credit_balance_used || 0)
        // If limit is 0, we consider the current debt as the "effective limit" for utilization purposes
        return acc + (limit > 0 ? limit : balance)
    }, 0)
    const computedUtilizationRate = computedTotalLimit > 0 ? (totalDebt / computedTotalLimit) * 100 : 0

    if (loading) return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
        </div>
    )

    if (error) return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-muted-foreground font-medium">{error}</p>
            <Button variant="outline" onClick={load} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
        </div>
    )

    const headerConfig = activeTab === 'portfolio' ? {
        title: "Cartera de Créditos",
        description: "Saldo por cliente, clasificación por antigüedad y estado de cobro.",
        iconName: "credit-card"
    } : {
        title: "Historial de Asignaciones",
        description: "Registro global de créditos asignados a clientes.",
        iconName: "history"
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={headerConfig.title}
                description={headerConfig.description}
                iconName={headerConfig.iconName}
                titleActions={activeTab === 'portfolio' && (
                    <PageHeaderButton icon={Plus} onClick={handleAssign} circular title="Asignar Crédito" />
                )}
            />

            <CreditAssignmentModal
                open={assignmentModalOpen}
                onOpenChange={setAssignmentModalOpen}
                contact={editingContact}
                onSuccess={load}
            />

            {activeTab === 'portfolio' ? (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <KpiCard
                            label="Deuda Total"
                            value={fmt(totalDebt)}
                            sub={`${s?.count_active || 0} clientes con deuda activa`}
                            icon={CreditCard}
                            color="bg-primary/10 text-primary border-primary/10"
                        />
                        <KpiCard
                            label="Exposición Total"
                            value={fmt(computedTotalLimit)}
                            sub={`Uso: ${computedUtilizationRate.toFixed(1)}% del límite total`}
                            icon={Target}
                            color="bg-violet-500/10 text-violet-600 border-violet-100"
                        />
                        <KpiCard
                            label="Pérdida Potencial"
                            value={fmt(potentialLoss)}
                            sub={`${s?.risk_distribution?.CRITICAL || 0} clientes en riesgo crítico`}
                            icon={ShieldAlert}
                            color={potentialLoss > 0 ? "bg-rose-500/10 text-rose-600 border-rose-100" : "bg-muted text-muted-foreground"}
                        />
                        <KpiCard
                            label="Tasa de Mora"
                            value={`${((totalOverdue / (totalDebt || 1)) * 100).toFixed(1)}%`}
                            sub={`${s?.count_overdue || 0} clientes con vencimientos`}
                            icon={Activity}
                            color={totalOverdue > 0 ? "bg-amber-500/10 text-amber-600 border-amber-100" : "bg-emerald-500/10 text-emerald-600 border-emerald-100"}
                        />
                    </div>

                    {/* Portfolio Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-6"
                    >
                        <DataTable
                            columns={portfolioColumns}
                            data={contacts as CreditContact[]}
                            cardMode
                            useAdvancedFilter
                            showToolbarSort={false}
                            globalFilterFields={["name", "display_id", "tax_id"]}
                            searchPlaceholder="Buscar cliente por nombre o rut..."
                            facetedFilters={[
                                {
                                    column: "status",
                                    title: "Estado",
                                    options: [
                                        { label: "Al día", value: "Al día" },
                                        { label: "Activo", value: "Activo" },
                                        { label: "En mora", value: "En mora" },
                                        { label: "Bloqueado", value: "Bloqueado" },
                                        { label: "Auto-Bloqueo", value: "Auto-Bloqueo" },
                                    ]
                                }
                            ]}
                            renderCustomView={(table) => (
                                <div className="overflow-x-auto pb-4">
                                    <table className="w-full text-left">
                                        <thead className="bg-transparent border-b border-border/50 hover:bg-transparent">
                                            {table.getHeaderGroups().map((headerGroup: any) => (
                                                <tr key={headerGroup.id}>
                                                    {headerGroup.headers.map((header: any) => (
                                                        <th key={header.id} className="px-4 py-3 h-9 align-middle text-muted-foreground font-medium text-xs whitespace-nowrap">
                                                            {header.isPlaceholder
                                                                ? null
                                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                                        </th>
                                                    ))}
                                                    {/* Extra col for expand chevron */}
                                                    <th className="px-3 py-3 w-12 text-center" />
                                                </tr>
                                            ))}
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {table.getRowModel().rows.map((row: any) => (
                                                <ExpandableContactRow key={row.id} row={row} onRefresh={load} />
                                            ))}
                                            {table.getRowModel().rows.length === 0 && (
                                                <tr>
                                                    <td colSpan={portfolioColumns.length + 1} className="h-24 text-center text-muted-foreground">
                                                        No se encontraron resultados.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        />
                    </motion.div>
                </>
            ) : (
                <CreditHistoryTable history={history} loading={loadingHistory} />
            )}
        </div>
    )
}
