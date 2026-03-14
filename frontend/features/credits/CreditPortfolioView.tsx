"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getCreditPortfolio, getContactCreditLedger, writeOffDebt, CreditContact, CreditPortfolioResponse, CreditLedgerEntry } from "@/lib/credits/api"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { cn } from "@/lib/utils"
import {
    AlertCircle, CreditCard, TrendingUp, Users, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle2, Ban, RefreshCw, Clock, ShieldAlert,
    Target, BarChart3, PieChart, Activity, Gavel
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

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

function ContactRow({ contact, onRefresh }: { contact: CreditContact, onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false)
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [loadingLedger, setLoadingLedger] = useState(false)
    const [writingOff, setWritingOff] = useState(false)
    const [showWriteOffDialog, setShowWriteOffDialog] = useState(false)

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

    const handleExpand = useCallback(async () => {
        const next = !expanded
        setExpanded(next)
        if (next && !ledger) {
            setLoadingLedger(true)
            try {
                const data = await getContactCreditLedger(contact.id)
                setLedger(data)
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

    return (
        <>
            <tr
                className={cn(
                    "border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors text-sm",
                    expanded && "bg-muted/20"
                )}
                onClick={handleExpand}
            >
                {/* Cliente */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-1 h-8 rounded-full shrink-0", riskColor[contact.credit_risk_level] || "bg-emerald-400")} />
                        <div>
                            <div className="font-semibold text-[13px] leading-tight flex items-center gap-2">
                                {contact.name}
                                {contact.credit_auto_blocked && <AlertCircle className="h-3 w-3 text-orange-500" />}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">{contact.display_id} · {contact.tax_id}</div>
                        </div>
                    </div>
                </td>
                {/* Límite */}
                <td className="px-4 py-3 text-right text-[12px] font-mono text-muted-foreground">
                    {contact.credit_limit ? fmt(contact.credit_limit) : <span className="text-muted-foreground/40">—</span>}
                </td>
                {/* Utilizado */}
                <td className="px-4 py-3 text-right font-mono font-bold text-[13px]">
                    {totalDebt > 0 ? fmt(totalDebt) : <span className="text-muted-foreground/40">—</span>}
                </td>
                {/* Corriente */}
                <td className={cn("px-3 py-3 text-right text-[12px] font-mono", agingColor.current)}>
                    {Number(aging.current) > 0 ? fmt(aging.current) : <span className="text-muted-foreground/30">—</span>}
                </td>
                {/* 1-30 */}
                <td className={cn("px-3 py-3 text-right text-[12px] font-mono", agingColor.overdue_30)}>
                    {Number(aging.overdue_30) > 0 ? fmt(aging.overdue_30) : <span className="text-muted-foreground/30">—</span>}
                </td>
                {/* 31-60 */}
                <td className={cn("px-3 py-3 text-right text-[12px] font-mono", agingColor.overdue_60)}>
                    {Number(aging.overdue_60) > 0 ? fmt(aging.overdue_60) : <span className="text-muted-foreground/30">—</span>}
                </td>
                {/* 61-90 */}
                <td className={cn("px-3 py-3 text-right text-[12px] font-mono", agingColor.overdue_90)}>
                    {Number(aging.overdue_90) > 0 ? fmt(aging.overdue_90) : <span className="text-muted-foreground/30">—</span>}
                </td>
                {/* +90 */}
                <td className={cn("px-3 py-3 text-right text-[12px] font-mono", agingColor.overdue_90plus)}>
                    {Number(aging.overdue_90plus) > 0 ? fmt(aging.overdue_90plus) : <span className="text-muted-foreground/30">—</span>}
                </td>
                {/* Estado */}
                <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border", statusBadge.cls)}>
                        {statusBadge.label}
                    </span>
                </td>
                {/* Expand */}
                <td className="px-3 py-3 text-muted-foreground">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </td>
            </tr>

            {/* Expanded Detail */}
            <AnimatePresence>
                {expanded && (
                    <tr>
                        <td colSpan={10} className="p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-muted/10 border-b border-border/50"
                            >
                                <div className="px-8 py-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            <AgingBar aging={aging} />
                                            <div className="flex gap-2 shrink-0 flex-wrap">
                                                {(["current", "overdue_30", "overdue_60", "overdue_90", "overdue_90plus"] as const).map(k =>
                                                    Number(aging[k]) > 0 ? (
                                                        <span key={k} className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", agingBg[k])}>
                                                            {agingLabel[k]}: {fmt(aging[k])}
                                                        </span>
                                                    ) : null
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className={cn("flex flex-col items-end px-3 py-1 rounded-lg border", riskBg[contact.credit_risk_level])}>
                                                <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">Clasificación de Riesgo</span>
                                                <span className="text-[11px] font-bold">{riskLabel[contact.credit_risk_level]}</span>
                                            </div>
                                            {contact.credit_last_evaluated && (
                                                <div className="flex flex-col items-end px-3 py-1 rounded-lg border bg-muted/30">
                                                    <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">Última Evaluación</span>
                                                    <span className="text-[11px] font-medium text-muted-foreground">{new Date(contact.credit_last_evaluated).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                            {totalDebt > 0 && (
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
                                        <table className="w-full text-[12px]">
                                            <thead>
                                                <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/30">
                                                    <th className="text-left pb-2 pr-4">Documento</th>
                                                    <th className="text-left pb-2 pr-4">Fecha</th>
                                                    <th className="text-left pb-2 pr-4">Vencimiento</th>
                                                    <th className="text-right pb-2 pr-4">Total</th>
                                                    <th className="text-right pb-2 pr-4">Pagado</th>
                                                    <th className="text-right pb-2 pr-4">Saldo</th>
                                                    <th className="text-left pb-2">Tramo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ledger.map(entry => (
                                                    <tr key={entry.id} className="border-b border-border/20 last:border-0">
                                                        <td className="py-2 pr-4 font-mono font-semibold">{entry.number || `NV-${entry.id}`}</td>
                                                        <td className="py-2 pr-4 text-muted-foreground">{entry.date}</td>
                                                        <td className="py-2 pr-4 text-muted-foreground">
                                                            {entry.due_date}
                                                            {entry.days_overdue > 0 && (
                                                                <span className="ml-1 text-rose-500 font-bold">({entry.days_overdue}d)</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 pr-4 text-right font-mono">{fmt(entry.effective_total)}</td>
                                                        <td className="py-2 pr-4 text-right font-mono text-emerald-600">{fmt(entry.paid_amount)}</td>
                                                        <td className="py-2 pr-4 text-right font-mono font-bold">{fmt(entry.balance)}</td>
                                                        <td className="py-2">
                                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", agingBg[entry.aging_bucket])}>
                                                                {agingLabel[entry.aging_bucket]}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-[12px] text-muted-foreground italic">Sin documentos pendientes.</p>
                                    )}
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    )
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function CreditPortfolioView() {
    const [data, setData] = useState<CreditPortfolioResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

    const contacts = data?.contacts || []

    return (
        <div className="space-y-6">
            {/* Dashboard Analytics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Cartera Total"
                    value={fmt(totalDebt)}
                    sub={`${s?.count_debtors || 0} clientes con deuda activa`}
                    icon={CreditCard}
                    color="bg-blue-500/10 text-blue-600 border-blue-100"
                />
                <KpiCard
                    label="Exposición Total"
                    value={fmt(s?.total_exposure)}
                    sub={`Uso: ${utilizationRate}% del límite total`}
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
                className="rounded-2xl border bg-card shadow-sm overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                    <div>
                        <h2 className="font-black text-sm uppercase tracking-widest">Libro de Cartera</h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{contacts.length} clientes con crédito configurado</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" size="sm" onClick={load} className="gap-1.5 text-[11px]">
                            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                        </Button>
                        <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                        <span className="text-[11px] text-muted-foreground">Fila ampliable para detalle de documentos</span>
                    </div>
                </div>

                {contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <CreditCard className="h-10 w-10 opacity-20" />
                        <p className="font-medium text-sm">No hay clientes con crédito configurado</p>
                        <p className="text-xs">Activa el crédito en la ficha de un contacto para verlo aquí.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <th className="text-left px-4 py-3">Cliente</th>
                                    <th className="text-right px-4 py-3">Límite</th>
                                    <th className="text-right px-4 py-3">Utilizado</th>
                                    <th className="text-right px-3 py-3 text-emerald-600">Corriente</th>
                                    <th className="text-right px-3 py-3 text-amber-500">1–30d</th>
                                    <th className="text-right px-3 py-3 text-orange-500">31–60d</th>
                                    <th className="text-right px-3 py-3 text-rose-500">61–90d</th>
                                    <th className="text-right px-3 py-3 text-rose-700">+90d</th>
                                    <th className="text-left px-4 py-3">Estado</th>
                                    <th className="px-3 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {contacts.map(c => (
                                    <ContactRow key={c.id} contact={c} onRefresh={load} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
