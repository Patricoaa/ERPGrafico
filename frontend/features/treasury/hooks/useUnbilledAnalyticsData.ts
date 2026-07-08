"use client"

import { useMemo } from "react"
import type { PendingChargeRow, UpcomingInstallment, UnbilledForecast } from "../types"
import { parseDateOnly } from "@/lib/utils"

// ── Color palettes ──────────────────────────────────────────────

const CHARGE_TYPE_COLORS: Record<string, string> = {
    COMMISSION: "#f59e0b",
    TAX: "#ef4444",
    FEE: "#3b82f6",
    INSURANCE: "#8b5cf6",
    OTHER: "#6b7280",
}

// ── Helpers ─────────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const map: Record<string, T[]> = {}
    for (const item of items) {
        const key = keyFn(item)
        if (!map[key]) map[key] = []
        map[key].push(item)
    }
    return map
}

function formatMonth(dateStr: string): string {
    const d = parseDateOnly(dateStr)
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatYear(dateStr: string): string {
    return parseDateOnly(dateStr).getFullYear().toString()
}

function formatDay(dateStr: string): string {
    const d = parseDateOnly(dateStr)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    return `${dd}/${mm}`
}

function granularityKey(dateStr: string, g: "day" | "month" | "year"): string {
    if (g === "day") return formatDay(dateStr)
    if (g === "year") return formatYear(dateStr)
    return formatMonth(dateStr)
}

function granularitySortValue(key: string, g: "day" | "month" | "year"): number {
    if (g === "day") {
        const [dd, mm, yyyy] = key.split("/").map(Number)
        return new Date(yyyy, mm - 1, dd).getTime()
    }
    if (g === "year") return Number(key)
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    const [m, y] = key.split(" ")
    return new Date(Number(y), months.indexOf(m), 1).getTime()
}

function today(): string {
    return new Date().toISOString().split("T")[0]
}

// ── Public types ────────────────────────────────────────────────

export interface TrendData {
    direction: "up" | "down"
    value: string
}

export interface TimelineEvent {
    date: string
    label: string
    description?: string
    status: "success" | "warning" | "destructive" | "neutral"
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

    // Credit composition (for pie + waffle)
    creditComposition: Array<{ id: string; value: number; color: string }>
    creditUtilizationPct: number

    // Credit utilization history
    creditUtilizationHistory: Array<{ month: string; used: number; limit: number }>

    // Upcoming events timeline
    upcomingEvents: TimelineEvent[]
    topUpcoming: Array<{ label: string; value: string; amount: number }>

    // Calendar heatmap data
    calendarData: Array<{ day: string; value: number }>

    // Category radar data
    radarData: Array<{ category: string; value: number }>

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
    granularity?: "day" | "month" | "year",
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
        const chargeTypeDistribution = Object.entries(chargeTypeGroups)
            .map(([id, items]) => ({
                id,
                value: items.length,
                color: CHARGE_TYPE_COLORS[id] ?? CHARGE_TYPE_COLORS.OTHER,
            }))
            .sort((a, b) => b.value - a.value)

        const chargeTypeTotal = Object.entries(chargeTypeGroups)
            .map(([id, items]) => ({
                id,
                value: items.reduce((s, c) => s + Number(c.amount), 0),
            }))
            .sort((a, b) => b.value - a.value)

        // ── Charge types over time (for stream) ────────────────
        const chargeTimeline = [...filteredCharges]
        const timelineGroups = groupBy(chargeTimeline, c => granularityKey(c.date, g))
        const chargeTypeKeys = Object.keys(CHARGE_TYPE_COLORS)
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
                    const d = parseDateOnly(key + "-02")
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

        const topPartners = partnerAggs.slice(0, 8)
        const partnerDistribution = partnerAggs.slice(0, 10).map(p => ({
            id: p.partner,
            value: p.total,
        }))

        // ── Credit composition ─────────────────────────────────
        const creditComposition = forecast
            ? [
                { id: "Deuda Facturada", value: parseFloat(forecast.current_debt), color: "#ef4444" },
                { id: "No Facturado", value: parseFloat(forecast.total_unbilled), color: "#f59e0b" },
                { id: "Disponible", value: parseFloat(forecast.available_credit ?? "0"), color: "#22c55e" },
            ].filter(d => d.value > 0)
            : []

        const totalLimit = forecast ? parseFloat(forecast.credit_limit ?? "0") : 0
        const totalUsed = forecast ? parseFloat(forecast.total_used) : 0
        const creditUtilizationPct = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0

        // ── Credit utilization history (from by_month projection) ──
        const creditUtilizationHistory = forecast?.by_month
            ? Object.entries(forecast.by_month)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, val]) => {
                    const d = parseDateOnly(key + "-02")
                    const month = d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" })
                    return {
                        month,
                        used: parseFloat(val.total) + parseFloat(forecast.current_debt),
                        limit: totalLimit || parseFloat(val.total) * 2,
                    }
                })
            : []

        // ── Calendar heatmap data ──────────────────────────────
        const calendarMap = new Map<string, number>()
        for (const c of filteredCharges) {
            calendarMap.set(c.date, (calendarMap.get(c.date) ?? 0) + Number(c.amount))
        }
        for (const i of filteredInstallments) {
            calendarMap.set(i.due_date, (calendarMap.get(i.due_date) ?? 0) + Number(i.principal_amount))
        }
        const calendarData = Array.from(calendarMap.entries())
            .map(([day, value]) => ({ day, value: Math.round(value) }))

        // ── Radar data ─────────────────────────────────────────
        const radarData = chargeTypeDistribution.map(ct => ({
            category: ct.id,
            value: ct.value,
        }))

        // ── Upcoming events timeline ───────────────────────────
        const now = today()
        const upcomingEvents: TimelineEvent[] = [...filteredInstallments]
            .filter(i => i.due_date >= now)
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .slice(0, 15)
            .map(i => ({
                date: parseDateOnly(i.due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
                label: `${i.partner_name ?? "Proveedor"} · Cuota ${i.number}/${i.total_installments}`,
                description: `$${Number(i.principal_amount).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`,
                status: i.due_date === now ? "warning" as const : "neutral" as const,
            }))

        // ── Top upcoming ──────────────────────────────────────
        const topUpcoming = [...filteredInstallments]
            .sort((a, b) => parseFloat(b.principal_amount) - parseFloat(a.principal_amount))
            .slice(0, 5)
            .map(i => ({
                label: `${i.partner_name ?? "Proveedor"} · ${parseDateOnly(i.due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`,
                value: `$${Number(i.principal_amount).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`,
                amount: Number(i.principal_amount),
            }))

        // ── Trends (period-over-period) ────────────────────────
        function inPeriod(c: PendingChargeRow, periodVal: number, gr: "day" | "month" | "year"): boolean {
            const d = parseDateOnly(c.date)
            if (isNaN(d.getTime())) return false
            if (gr === "year") return d.getFullYear() === periodVal
            if (gr === "day") return Math.floor(d.getTime() / 86_400_000) === periodVal
            return d.getMonth() + d.getFullYear() * 12 === periodVal
        }

        function inPeriodInst(i: UpcomingInstallment, periodVal: number, gr: "day" | "month" | "year"): boolean {
            const d = parseDateOnly(i.due_date)
            if (isNaN(d.getTime())) return false
            if (gr === "year") return d.getFullYear() === periodVal
            if (gr === "day") return Math.floor(d.getTime() / 86_400_000) === periodVal
            return d.getMonth() + d.getFullYear() * 12 === periodVal
        }

        const _now = new Date()
        const currPeriod = g === "year" ? _now.getFullYear()
            : g === "day" ? Math.floor(_now.getTime() / 86_400_000)
            : _now.getMonth() + _now.getFullYear() * 12
        const prevPeriod = currPeriod - 1

        function sumChargesInPeriod(items: PendingChargeRow[], p: number) {
            return items.filter(c => inPeriod(c, p, g)).reduce((s, c) => s + Number(c.amount), 0)
        }
        function sumInstInPeriod(items: UpcomingInstallment[], p: number) {
            return items.filter(i => inPeriodInst(i, p, g)).reduce((s, i) => s + Number(i.principal_amount), 0)
        }
        function countChargesInPeriod(items: PendingChargeRow[], p: number) {
            return items.filter(c => inPeriod(c, p, g)).length
        }
        function countInstInPeriod(items: UpcomingInstallment[], p: number) {
            return items.filter(i => inPeriodInst(i, p, g)).length
        }

        const currTotal = sumChargesInPeriod(charges, currPeriod) + sumInstInPeriod(upcomingInstallments, currPeriod)
        const prevTotal = sumChargesInPeriod(charges, prevPeriod) + sumInstInPeriod(upcomingInstallments, prevPeriod)
        const totalTrend: TrendData = {
            direction: currTotal >= prevTotal ? "up" : "down",
            value: prevTotal > 0 ? `${Math.round(((currTotal - prevTotal) / prevTotal) * 100)}%` : "—",
        }

        const currCnt = countChargesInPeriod(charges, currPeriod) + countInstInPeriod(upcomingInstallments, currPeriod)
        const prevCnt = countChargesInPeriod(charges, prevPeriod) + countInstInPeriod(upcomingInstallments, prevPeriod)
        const chargeCountTrend: TrendData = {
            direction: currCnt >= prevCnt ? "up" : "down",
            value: prevCnt > 0 ? `${Math.round(((currCnt - prevCnt) / prevCnt) * 100)}%` : "—",
        }

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
            creditUtilizationHistory,
            upcomingEvents,
            topUpcoming,
            calendarData,
            radarData,
            forecast,
            summary,
            upcomingInstallments: filteredInstallments,
        }
    }, [charges, upcomingInstallments, forecast, summary, dateRange, granularity])
}
