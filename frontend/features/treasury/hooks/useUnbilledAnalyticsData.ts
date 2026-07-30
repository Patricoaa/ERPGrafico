import { useMemo } from "react"
import type { PendingChargeRow, UpcomingInstallment, UnbilledForecast } from "../types"
import { assignChartColors } from "@/lib/chart-colors"
import { groupBy, formatMonth, granularityKey, granularitySortValue } from "@/lib/analytics-helpers"
import type { Granularity } from "@/lib/analytics-helpers"

// ── Public types ────────────────────────────────────────────────

export interface TrendData {
    direction: "up" | "down"
    value: string
}

export interface UnbilledAnalyticsData {
    // Scalars
    totalUnbilled: number
    chargeCount: number
    installmentCount: number
    totalItems: number

    // Trends (period-over-period)
    totalTrend: TrendData
    chargeCountTrend: TrendData

    // Charge type distribution
    chargeTypeDistribution: Array<{ id: string; value: number; color: string }>
    chargeTypeTotal: Array<{ id: string; value: number }>

    // Monthly charges by type (for stream)
    chargeTypeOverTime: Array<Record<string, string | number>>

    // Daily accumulation (for line chart)
    dailyAccumulation: Array<{ date: string; total: number; count: number }>

    // Monthly new charges (stacked bar)
    monthlyNewCharges: Array<{ month: string; charges: number; installments: number }>

    // Monthly projection from forecast
    monthlyProjection: Array<{ month: string; total: number; count: number }>

    // Supplier/partner distribution
    partnerDistribution: Array<{ id: string; value: number }>
    topPartners: Array<{ partner: string; total: number; count: number }>

    // Credit composition (for pie)
    creditComposition: Array<{ id: string; value: number; color: string }>
    creditUtilizationPct: number

    // Raw passthrough
    forecast: UnbilledForecast | undefined
    summary: { total: number; count: number; charges: number; installments: number } | undefined
    upcomingInstallments: UpcomingInstallment[]
}

export function useUnbilledAnalyticsData(
    charges: PendingChargeRow[],
    upcomingInstallments: UpcomingInstallment[],
    forecast: UnbilledForecast | undefined,
    summary: { total: number; count: number; charges: number; installments: number } | undefined,
    dateRange?: { from: string; to: string } | null,
    granularity?: Granularity,
): UnbilledAnalyticsData {
    return useMemo(() => {
        const g = granularity ?? "month"

        // ── Filter by date range ───────────────────────────────
        const filteredCharges = dateRange
            ? charges.filter(c => c.date >= dateRange.from && c.date <= dateRange.to)
            : charges
        const filteredInstallments = dateRange
            ? upcomingInstallments.filter(i => i.due_date >= dateRange.from && i.due_date <= dateRange.to)
            : upcomingInstallments

        // ── Scalars ────────────────────────────────────────────
        const chargeCount = filteredCharges.length
        const installmentCount = filteredInstallments.length
        const totalItems = chargeCount + installmentCount
        const totalUnbilled = filteredCharges.reduce((s, c) => s + Number(c.amount), 0)
            + filteredInstallments.reduce((s, i) => s + Number(i.principal_amount), 0)

        // ── Charge type distribution ───────────────────────────
        const chargeTypeGroups = groupBy(filteredCharges, c => c.charge_type || "OTHER")
        const chargeTypeDistribution = assignChartColors(
            Object.entries(chargeTypeGroups)
                .map(([id, items]) => ({ id, value: items.length }))
                .sort((a, b) => b.value - a.value),
        )

        const chargeTypeTotal = Object.entries(chargeTypeGroups)
            .map(([id, items]) => ({
                id,
                value: items.reduce((s, c) => s + Number(c.amount), 0),
            }))
            .sort((a, b) => b.value - a.value)

        // ── Charge types over time (for stream) ────────────────
        const chargeTimeline = [...filteredCharges]
        const timelineGroups = groupBy(chargeTimeline, c => granularityKey(c.date, g))
        const chargeTypeKeys = chargeTypeDistribution.map((d) => d.id)
        const chargeTypeOverTime = Object.entries(timelineGroups)
            .map(([period, items]) => {
                const byType = groupBy(items, c => c.charge_type || "OTHER")
                const row: Record<string, string | number> = { month: period }
                for (const key of chargeTypeKeys) {
                    const match = byType[key]
                    row[key.toLowerCase()] = match ? match.reduce((s, c) => s + Number(c.amount), 0) : 0
                }
                const otherItems = items.filter(c => {
                    const t = c.charge_type || "OTHER"
                    return !chargeTypeKeys.includes(t)
                })
                row.other = otherItems.reduce((s, c) => s + Number(c.amount), 0)
                return row
            })
            .sort((a, b) => granularitySortValue(String(a.month), g) - granularitySortValue(String(b.month), g))

        // ── Daily accumulation (running total) ─────────────────
        interface TempItem { date: string; amount: number }
        const allItems: TempItem[] = [
            ...filteredCharges.map(c => ({ date: c.date, amount: Number(c.amount) })),
            ...filteredInstallments.map(i => ({ date: i.due_date, amount: Number(i.principal_amount) })),
        ].sort((a, b) => a.date.localeCompare(b.date))

        let running = 0
        const dailyMap = new Map<string, { total: number; count: number }>()
        for (const item of allItems) {
            running += item.amount
            dailyMap.set(item.date, {
                total: running,
                count: (dailyMap.get(item.date)?.count ?? 0) + 1,
            })
        }
        const dailyAccumulation = Array.from(dailyMap.entries())
            .map(([date, val]) => ({ date, total: val.total, count: val.count }))

        // ── Monthly new charges (charges vs installments) ──────
        const chargePeriods = groupBy(filteredCharges, c => formatMonth(c.date))
        const installmentPeriods = groupBy(filteredInstallments, i => formatMonth(i.due_date))
        const allPeriods = new Set([
            ...Object.keys(chargePeriods),
            ...Object.keys(installmentPeriods),
        ])
        const monthlyNewCharges = Array.from(allPeriods)
            .map(month => ({
                month,
                charges: (chargePeriods[month] || []).reduce((s, c) => s + Number(c.amount), 0),
                installments: (installmentPeriods[month] || []).reduce((s, i) => s + Number(i.principal_amount), 0),
            }))
            .sort((a, b) => {
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
                    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
                const [mA, yA] = a.month.split(" ")
                const [mB, yB] = b.month.split(" ")
                return (Number(yA) * 12 + months.indexOf(mA)) - (Number(yB) * 12 + months.indexOf(mB))
            })

        // ── Monthly projection from forecast ───────────────────
        const monthlyProjection = forecast?.by_month
            ? Object.entries(forecast.by_month)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, val]) => {
                    const d = new Date(key + "-02")
                    return {
                        month: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
                        total: parseFloat(val.total),
                        count: val.count,
                    }
                })
            : []

        // ── Partner/supplier distribution ──────────────────────
        const partnerGroups = groupBy(filteredInstallments, i => i.partner_name || "Desconocido")
        const partnerAggs = Object.entries(partnerGroups)
            .map(([partner, items]) => ({
                partner,
                total: items.reduce((s, i) => s + Number(i.principal_amount), 0),
                count: items.length,
            }))
            .sort((a, b) => b.total - a.total)

        const partnerDistribution = partnerAggs
            .filter(p => p.total > 0)
            .map(p => ({ id: p.partner, value: p.total }))

        const topPartners = partnerAggs.slice(0, 8)

        // ── Credit composition (pie) ────────────────────────────
        const creditLimit = forecast?.credit_limit ? parseFloat(forecast.credit_limit) : 0
        const creditUtilizationPct = creditLimit > 0 ? Math.min(100, Math.round(((totalUnbilled + parseFloat(forecast?.current_debt ?? '0')) / creditLimit) * 100)) : 0
        const totalUsed = totalUnbilled + parseFloat(forecast?.current_debt ?? '0')
        const remaining = Math.max(0, creditLimit - totalUsed)

        const creditComposition = assignChartColors([
            { id: "Utilizado", value: totalUsed },
            ...(remaining > 0 ? [{ id: "Disponible", value: remaining }] : []),
        ])

        // ── Trends (period-over-period) ────────────────────────
        function periodKey(itemDate: string): number {
            if (g === "year") return new Date(itemDate).getFullYear()
            if (g === "day") return Math.floor(new Date(itemDate).getTime() / 86_400_000)
            const d = new Date(itemDate)
            return d.getMonth() + d.getFullYear() * 12
        }

        const _now = new Date()
        const currPeriod = g === "year" ? _now.getFullYear() : g === "day" ? Math.floor(_now.getTime() / 86_400_000) : _now.getMonth() + _now.getFullYear() * 12
        const prevPeriod = currPeriod - 1

        function isInPeriod(dateStr: string | undefined, period: number): boolean {
            return !!dateStr && periodKey(dateStr) === period
        }

        const currTotalCharges = filteredCharges.filter(c => isInPeriod(c.date, currPeriod)).reduce((s, c) => s + Number(c.amount), 0)
        const prevTotalCharges = filteredCharges.filter(c => isInPeriod(c.date, prevPeriod)).reduce((s, c) => s + Number(c.amount), 0)
        const currTotalInst = filteredInstallments.filter(i => isInPeriod(i.due_date, currPeriod)).reduce((s, i) => s + Number(i.principal_amount), 0)
        const prevTotalInst = filteredInstallments.filter(i => isInPeriod(i.due_date, prevPeriod)).reduce((s, i) => s + Number(i.principal_amount), 0)

        const currTotal = currTotalCharges + currTotalInst
        const prevTotal = prevTotalCharges + prevTotalInst
        const totalTrend: TrendData = { direction: currTotal >= prevTotal ? "up" : "down", value: prevTotal > 0 ? `${Math.round(((currTotal - prevTotal) / prevTotal) * 100)}%` : "—" }

        const currCount = filteredCharges.filter(c => isInPeriod(c.date, currPeriod)).length
            + filteredInstallments.filter(i => isInPeriod(i.due_date, currPeriod)).length
        const prevCount = filteredCharges.filter(c => isInPeriod(c.date, prevPeriod)).length
            + filteredInstallments.filter(i => isInPeriod(i.due_date, prevPeriod)).length
        const chargeCountTrend: TrendData = { direction: currCount >= prevCount ? "up" : "down", value: prevCount > 0 ? `${Math.round(((currCount - prevCount) / prevCount) * 100)}%` : "—" }

        return {
            totalUnbilled,
            chargeCount,
            installmentCount,
            totalItems,
            totalTrend,
            chargeCountTrend,
            chargeTypeDistribution,
            chargeTypeTotal,
            chargeTypeOverTime,
            dailyAccumulation,
            monthlyNewCharges,
            monthlyProjection,
            partnerDistribution,
            topPartners,
            creditComposition,
            creditUtilizationPct,
            forecast,
            summary,
            upcomingInstallments: filteredInstallments,
        }
    }, [charges, upcomingInstallments, forecast, summary, dateRange, granularity])
}
