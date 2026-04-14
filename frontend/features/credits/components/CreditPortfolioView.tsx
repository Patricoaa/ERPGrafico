"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    getCreditPortfolio, 
    getContactCreditLedger, 
    getGlobalCreditHistory, 
    writeOffDebt, 
    writeOffSaleOrder, 
    CreditContact, 
    CreditPortfolioResponse, 
    CreditLedgerEntry, 
    CreditHistoryEntry 
} from "@/lib/credits/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    AlertCircle, CreditCard, TrendingUp, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle2, RefreshCw, Clock, ShieldAlert,
    Target, Activity, Gavel, HelpCircle
} from "lucide-react"
import CreditAssignmentModal from "./CreditAssignmentModal"
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
import { flexRender } from "@tanstack/react-table"
import { TableRow, TableCell } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: string | number | undefined) =>
    Number(v || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

const EMPTY_CONTACTS: CreditContact[] = []
const EMPTY_HISTORY: CreditHistoryEntry[] = []

// ─── Sub-components ──────────────────────────────────────────────────────────

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
                "rounded-lg border bg-card p-5 flex flex-col gap-3 shadow-sm relative overflow-hidden",
            )}
        >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                <Icon className="w-12 h-12" />
            </div>
            <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                <div className={cn("p-2 rounded-lg border", color)}>
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
    // We use Tailwind classes that map to our semantic tokens where possible, or specific colors for levels
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

function ExpandableContactRow({ row, onRefresh }: { row: any, onRefresh: () => void }) {
    const contact = row.original as CreditContact
    const [expanded, setExpanded] = useState(false)
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
                                        <div className="space-y-2">
                                            {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
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
                                                                    <span className={cn("text-[10px] items-center gap-1.5 font-bold px-2 py-0.5 rounded border inline-flex", agingBg[entry.aging_bucket])}>
                                                                        {entry.aging_bucket === 'current' ? <CheckCircle2 className="h-3.5 w-3.5" /> : (entry.days_overdue > 60 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />)}
                                                                        {agingLabel[entry.aging_bucket]}
                                                                    </span>
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

const portfolioColumns: (onEdit: (c: CreditContact) => void) => ColumnDef<CreditContact>[] = (onEdit) => [
    {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
        cell: ({ row }) => {
            const contact = row.original
            return (
                <DataCell.ContactLink contactId={contact.id}>
                    {contact.name}
                    {contact.credit_auto_blocked && <AlertCircle className="h-3 w-3 text-warning ml-2" />}
                </DataCell.ContactLink>
            )
        },
    },
    {
        accessorKey: "credit_risk_level",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Riesgo" className="justify-center" />,
        cell: ({ row }) => {
            const risk = row.original.credit_risk_level
            const color = risk === 'LOW' ? 'text-success' : 
                         risk === 'MEDIUM' ? 'text-warning' : 
                         risk === 'HIGH' ? 'text-warning' : 'text-destructive'
            const label = risk === 'LOW' ? 'Bajo' : 
                         risk === 'MEDIUM' ? 'Medio' : 
                         risk === 'HIGH' ? 'Alto' : 'Crítico'
            
            return (
                <DataCell.Text className={cn("font-black uppercase tracking-tighter text-[11px]", color)}>
                    {label}
                </DataCell.Text>
            )
        }
    },
    {
        accessorKey: "credit_limit",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Límite" className="justify-center" />,
        cell: ({ row }) => {
            const contact = row.original
            const limit = Number(contact.credit_limit || 0)
            return (
                <div className="flex justify-center w-full" onClick={(e) => { e.stopPropagation(); onEdit(contact); }}>
                    <DataCell.Currency value={limit} className="font-bold cursor-pointer hover:underline text-primary" />
                </div>
            )
        },
    },
    {
        accessorKey: "credit_balance_used",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Utilizado" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Currency value={row.original.credit_balance_used} className="text-info font-black" />
            </div>
        ),
    },
    {
        id: "current",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Vigente" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Currency value={row.original.credit_aging.current} className="text-success" />
            </div>
        ),
    },
    {
        id: "overdue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="En Mora" className="justify-center text-destructive" />,
        cell: ({ row }) => {
            const aging = row.original.credit_aging
            const val = Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus)
            return (
                <div className="flex justify-center w-full">
                    <div className={cn("text-center text-[12px] font-mono", val > 0 ? "text-destructive font-black" : "")}>{val > 0 ? fmt(val) : <span className="text-muted-foreground/30">—</span>}</div>
                </div>
            )
        },
    },
    {
        id: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
        accessorFn: (row) => {
            const hasOverdue = Number(row.credit_aging.overdue_30) + Number(row.credit_aging.overdue_60) + Number(row.credit_aging.overdue_90) + Number(row.credit_aging.overdue_90plus) > 0
            if (row.credit_blocked) return "Bloqueado"
            if (row.credit_auto_blocked) return "Auto-Bloqueo"
            if (hasOverdue) return "En mora"
            if (Number(row.credit_balance_used) > 0) return "Activo"
            return "Al día"
        },
        cell: ({ row }) => {
            const contact = row.original
            const totalDebt = Number(contact.credit_balance_used)
            const aging = contact.credit_aging
            const hasOverdue = Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus) > 0

            const statusKey = contact.credit_blocked ? "ERROR" : 
                             contact.credit_auto_blocked ? "WARNING" : 
                             hasOverdue ? "WARNING" : 
                             totalDebt > 0 ? "INFO" : "SUCCESS";
            const label = contact.credit_blocked ? "Bloqueado" : 
                         contact.credit_auto_blocked ? "Auto-Bloqueo" : 
                         hasOverdue ? "En mora" : 
                         totalDebt > 0 ? "Activo" : "Al día";

            return (
                <div className="flex justify-center w-full">
                    <StatusBadge status={statusKey} label={label} />
                </div>
            )
        },
    },
]

const historyColumns: ColumnDef<CreditHistoryEntry>[] = [
    {
        accessorKey: "date",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Date value={row.original.date} />
            </div>
        )
    },
    {
        accessorKey: "customer_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
        cell: ({ row }) => (
            <DataCell.ContactLink contactId={(row.original as any).customer_id || (row.original as any).customer}>
                {row.original.customer_name}
            </DataCell.ContactLink>
        )
    },
    {
        accessorKey: "number",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Nota Venta" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Code>NV-{row.original.number}</DataCell.Code>
            </div>
        )
    },
    {
        accessorKey: "effective_total",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Currency value={row.original.effective_total} className="font-black" />
            </div>
        )
    },
    {
        accessorKey: "credit_assignment_origin",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Origen" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <StatusBadge 
                    status={`ORIGIN_${row.original.credit_assignment_origin}`} 
                    label={row.original.credit_assignment_origin_display}
                />
            </div>
        )
    },
]

// ─── Main View ───────────────────────────────────────────────────────────────

export function CreditPortfolioView({ 
    activeTab = 'portfolio',
    externalOpen = false
}: { 
    activeTab?: 'portfolio' | 'history',
    externalOpen?: boolean
}) {
    const [data, setData] = useState<CreditPortfolioResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [history, setHistory] = useState<CreditHistoryEntry[] | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(false)

    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<CreditContact | null>(null)

    const handleEditLimit = useCallback((contact: CreditContact) => {
        setEditingContact(contact)
        setAssignmentModalOpen(true)
    }, [])

    const portfolioCols = useMemo(() => portfolioColumns(handleEditLimit), [handleEditLimit])

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

    useEffect(() => {
        if (activeTab === 'history' && !history) {
            setLoadingHistory(true)
            getGlobalCreditHistory()
                .then(setHistory)
                .catch(() => toast.error("Error cargando historial"))
                .finally(() => setLoadingHistory(false))
        }
    }, [activeTab, history])

    useEffect(() => {
        if (externalOpen) {
            setEditingContact(null)
            setAssignmentModalOpen(true)
        }
    }, [externalOpen])

    // Summary and contacts calculation
    const s = data?.summary
    const totalDebt = Number(s?.total_debt || 0)
    const potentialLoss = Number(s?.potential_loss || 0)
    const totalOverdue = Number(s?.overdue_30 || 0) + Number(s?.overdue_60 || 0) + Number(s?.overdue_90 || 0) + Number(s?.overdue_90plus || 0)
    const contacts = data?.contacts || EMPTY_CONTACTS

    const renderPortfolioCustomView = useCallback((table: any) => {
        const rows = table.getRowModel().rows
        if (rows.length === 0 && !loading) {
            return (
                <EmptyState
                    context="finance"
                    title="No hay clientes con crédito"
                    description="Habilite cupos de crédito para sus clientes para comenzar el seguimiento."
                    action={<Button onClick={() => setAssignmentModalOpen(true)}>Asignar Crédito</Button>}
                />
            )
        }
        return (
            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left">
                    <thead className="border-b border-border/50">
                    {table.getHeaderGroups().map((headerGroup: any) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header: any) => (
                                <th key={header.id} className="px-4 py-3 text-muted-foreground font-black text-[10px] uppercase tracking-widest whitespace-nowrap">
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                            <th className="px-3 py-3 w-12" />
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-border/50">
                    {table.getRowModel().rows.map((row: any) => (
                        <ExpandableContactRow key={row.id} row={row} onRefresh={load} />
                    ))}
                </tbody>
            </table>
        </div>
        )
    }, [loading, load])

    if (error) return (
        <EmptyState
            context="finance"
            title="Error al cargar datos"
            description={error}
            action={<Button onClick={load}>Reintentar</Button>}
        />
    )

    const computedTotalLimit = contacts.reduce((acc, c) => {
        const limit = Number(c.credit_limit || 0)
        const balance = Number(c.credit_balance_used || 0)
        return acc + (limit > 0 ? limit : balance)
    }, 0)
    const computedUtilizationRate = computedTotalLimit > 0 ? (totalDebt / computedTotalLimit) * 100 : 0

    return (
        <div className="space-y-6">
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
                            sub={`${s?.count_debtors || 0} clientes con deuda activa`}
                            icon={CreditCard}
                            color="bg-primary/5 text-primary border-primary/20"
                        />
                        <KpiCard
                            label="Exposición Total"
                            value={fmt(computedTotalLimit)}
                            sub={`Uso: ${computedUtilizationRate.toFixed(1)}% del límite`}
                            icon={Target}
                            color="bg-info/5 text-info border-info/20"
                        />
                        <KpiCard
                            label="Pérdida Potencial"
                            value={fmt(potentialLoss)}
                            sub={`${s?.risk_distribution?.CRITICAL || 0} riesgos críticos`}
                            icon={ShieldAlert}
                            color={potentialLoss > 0 ? "bg-destructive/5 text-destructive border-destructive/20" : "bg-muted text-muted-foreground border-border"}
                        />
                        <KpiCard
                            label="Tasa de Mora"
                            value={`${((totalOverdue / (totalDebt || 1)) * 100).toFixed(1)}%`}
                            sub={`${s?.count_overdue || 0} vencimientos`}
                            icon={Activity}
                            color={totalOverdue > 0 ? "bg-warning/5 text-warning border-warning/20" : "bg-success/5 text-success border-success/20"}
                        />
                    </div>

                    <div className="mt-6">
                            <DataTable
                                columns={portfolioCols}
                                data={contacts}
                                cardMode
                                isLoading={loading}
                                useAdvancedFilter
                                globalFilterFields={["name", "tax_id"]}
                                searchPlaceholder="Buscar cliente..."
                                renderCustomView={renderPortfolioCustomView}
                            />
                    </div>
                </>
            ) : (
                <div className="mt-2">
                        <DataTable
                            columns={historyColumns}
                            data={history || EMPTY_HISTORY}
                            cardMode
                            isLoading={loadingHistory}
                            useAdvancedFilter
                            globalFilterFields={["customer_name", "number"]}
                            searchPlaceholder="Filtrar historial..."
                        />
                </div>
            )}
        </div>
    )
}
