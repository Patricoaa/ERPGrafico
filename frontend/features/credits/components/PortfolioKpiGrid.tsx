"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { CreditCard, Target, ShieldAlert, Activity } from "lucide-react"
import { CreditPortfolioResponse } from "@/features/credits/api/creditsApi"

const fmt = (v: string | number | undefined) =>
    Number(v || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

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

export function PortfolioKpiGrid({ data }: { data: CreditPortfolioResponse | null }) {
    if (!data) return null

    const s = data.summary
    const totalDebt = Number(s?.total_debt || 0)
    const potentialLoss = Number(s?.potential_loss || 0)
    const totalOverdue = Number(s?.overdue_30 || 0) + Number(s?.overdue_60 || 0) + Number(s?.overdue_90 || 0) + Number(s?.overdue_90plus || 0)
    const contacts = data.contacts || []

    const computedTotalLimit = contacts.reduce((acc, c) => {
        const limit = Number(c.credit_limit || 0)
        const balance = Number(c.credit_balance_used || 0)
        return acc + (limit > 0 ? limit : balance)
    }, 0)
    const computedUtilizationRate = computedTotalLimit > 0 ? (totalDebt / computedTotalLimit) * 100 : 0

    return (
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
    )
}
