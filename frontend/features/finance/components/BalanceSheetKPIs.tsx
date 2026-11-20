"use client"

import React from "react"
import { Metric, MetricStrip, type MetricDelta } from "@/components/shared"
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
            <MetricStrip label="Indicadores del balance">
                {[1, 2, 3, 4].map((i) => (
                    <Metric key={i} label="Cargando" value="—" loading />
                ))}
            </MetricStrip>
        )
    }

    const a = data.total_assets || 0
    const p = data.total_liabilities || 0
    const e = data.total_equity || 0
    const workingCapital = a - p

    const trend = (current: number, comp?: number): MetricDelta | undefined =>
        showComparison && comp ? { current, previous: comp } : undefined

    return (
        <MetricStrip label="Indicadores del balance">
            <Metric
                label="Total Activos"
                value={formatMoney(a)}
                lead={Landmark}
                delta={trend(a, data.total_assets_comp)}
            />
            <Metric
                label="Total Pasivos"
                value={formatMoney(p)}
                lead={Banknote}
                delta={trend(p, data.total_liabilities_comp)}
            />
            <Metric
                label="Total Patrimonio"
                value={formatMoney(e)}
                lead={PiggyBank}
                delta={trend(e, data.total_equity_comp)}
            />
            <Metric
                label="Capital de Trabajo"
                value={formatMoney(workingCapital)}
                lead={TrendingUp}
                delta={trend(workingCapital, (data.total_assets_comp ?? 0) - (data.total_liabilities_comp ?? 0))}
                tone={workingCapital >= 0 ? "success" : "destructive"}
            />
        </MetricStrip>
    )
}
