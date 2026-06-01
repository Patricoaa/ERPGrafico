"use client"

import { CreditCard, Target, ShieldAlert, Activity } from "lucide-react"
import { CreditPortfolioResponse } from "@/features/credits/api/creditsApi"
import { MoneyDisplay, StatCard } from "@/components/shared"

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
            <StatCard
                label="Deuda Total"
                value={<MoneyDisplay amount={totalDebt} digits={0} />}
                subtext={`${s?.count_debtors || 0} clientes con deuda activa`}
                icon={CreditCard}
                accent="primary"
            />
            <StatCard
                label="Exposición Total"
                value={<MoneyDisplay amount={computedTotalLimit} digits={0} />}
                subtext={`Uso: ${computedUtilizationRate.toFixed(1)}% del límite`}
                icon={Target}
                accent="info"
            />
            <StatCard
                label="Pérdida Potencial"
                value={<MoneyDisplay amount={potentialLoss} digits={0} />}
                subtext={`${s?.risk_distribution?.CRITICAL || 0} riesgos críticos`}
                icon={ShieldAlert}
                accent={potentialLoss > 0 ? "destructive" : "muted"}
            />
            <StatCard
                label="Tasa de Mora"
                value={`${((totalOverdue / (totalDebt || 1)) * 100).toFixed(1)}%`}
                subtext={`${s?.count_overdue || 0} vencimientos`}
                icon={Activity}
                accent={totalOverdue > 0 ? "warning" : "success"}
            />
        </div>
    )
}
