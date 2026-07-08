"use client"

import React from "react"
import { StatCard } from "@/components/shared"
import { Landmark, Banknote, PiggyBank, TrendingUp } from "lucide-react"
import type { BalanceSheetData } from "../types"
import { formatMoney } from "@/lib/money"

interface BalanceSheetKPIsProps {
    data: BalanceSheetData
    showComparison: boolean
    isLoading?: boolean
}

export function BalanceSheetKPIs({ data, showComparison, isLoading }: BalanceSheetKPIsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <StatCard key={i} label="Cargando" value="—" loading />
                ))}
            </div>
        )
    }

    const a = data.total_assets || 0
    const p = data.total_liabilities || 0
    const e = data.total_equity || 0
    const workingCapital = a - p

    const trend = (current: number, comp?: number) => {
        if (!comp || comp === 0) return undefined
        const diff = current - comp
        const pct = (diff / Math.abs(comp)) * 100
        return {
            direction: (diff >= 0 ? 'up' : 'down') as 'up' | 'down',
            value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs período anterior`,
        }
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
                label="Total Activos"
                value={formatMoney(a)}
                icon={Landmark}
                trend={showComparison ? trend(a, data.total_assets_comp) : undefined}
                accent="info"
                valueSize="lg"
            />
            <StatCard
                label="Total Pasivos"
                value={formatMoney(p)}
                icon={Banknote}
                trend={showComparison ? trend(p, data.total_liabilities_comp) : undefined}
                accent="warning"
                valueSize="lg"
            />
            <StatCard
                label="Total Patrimonio"
                value={formatMoney(e)}
                icon={PiggyBank}
                trend={showComparison ? trend(e, data.total_equity_comp) : undefined}
                accent="primary"
                valueSize="lg"
            />
            <StatCard
                label="Capital de Trabajo"
                value={formatMoney(workingCapital)}
                icon={TrendingUp}
                trend={showComparison ? trend(workingCapital, (data.total_assets_comp ?? 0) - (data.total_liabilities_comp ?? 0)) : undefined}
                accent={workingCapital >= 0 ? "success" : "destructive"}
                valueSize="lg"
            />
        </div>
    )
}
