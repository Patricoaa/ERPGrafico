"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { treasuryApi } from "../api/treasuryApi"
import type { TcHubAnalyticsResponse } from "./analyticsTypes"
import type { PendingChargeRow, UpcomingInstallment, UnbilledForecast } from "../types"

// ── Color palettes ──────────────────────────────────────────────

const CHARGE_TYPE_COLORS: Record<string, string> = {
    COMMISSION: "#f59e0b",
    TAX: "#ef4444",
    FEE: "#3b82f6",
    INSURANCE: "#8b5cf6",
    OTHER: "#6b7280",
}

// ── Helpers (reused from useUnbilledAnalyticsData) ────────────────────

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
    const d = new Date(dateStr)
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatYear(dateStr: string): string {
    return new Date(dateStr).getFullYear().toString()
}

function formatDay(dateStr: string): string {
    const d = new Date(dateStr)
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

export interface TcTrendData {
    direction: "up" | "down"
    value: string
}

export interface TcTimelineEvent {
    date: string
    label: string
    description?: string
    status: "success" | "warning" | "destructive" | "neutral"
}

export interface TcHubData {
    // ── Analytics (from analytics endpoint) ──
    analytics: TcHubAnalyticsResponse | undefined
    analyticsLoading: boolean

    // ── Unbilled data (from unbilled-charges endpoint) ──
    charges: PendingChargeRow[]
    upcomingInstallments: UpcomingInstallment[]
    forecast: UnbilledForecast | undefined
    unbilledSummary: { total: number; count: number; charges: number; installments: number } | undefined
    unbilledLoading: boolean

    // ── Computed cross-dimension metrics ──
    totalDebt: number
    totalUnbilled: number
    totalCombined: number
    overdueCount: number
    openCount: number

    financialCostsTrend: TcTrendData
    paymentPerformanceChart: Array<{ id: string; data: Array<{ x: string; y: number }> }>
    financialCostsChart: Array<{ period: string; interest: number; fees: number; total: number }>
    creditUtilizationHistory: Array<{ period: string; used: number; limit: number }>
    nextUpcomingPayments: TcTimelineEvent[]

    // ── State for hub controls ──
    granularity: "day" | "month" | "year"
    dateRange: { from: string; to: string } | null
}

export function useTcHubData(
    cardAccountId: number | null,
    granularity: "day" | "month" | "year" = "month",
    dateRange: { from: string; to: string } | null = null,
): TcHubData {
    // ── Analytics query ────────────────────────────
    const {
        data: analytics,
        isLoading: analyticsLoading,
    } = useQuery({
        queryKey: ['card-analytics', cardAccountId],
        queryFn: () => treasuryApi.getCardAnalytics({
            card_account: cardAccountId ?? undefined,
            months: 12,
        }),
        enabled: cardAccountId != null,
    })

    // ── Unbilled charges query ─────────────────────
    const todayStr = today()
    const { data: unbilledResult, isLoading: unbilledLoading } = useQuery({
        queryKey: ['unbilled-charges', cardAccountId, 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId!),
        enabled: cardAccountId != null,
    })

    const charges: PendingChargeRow[] = unbilledResult?.charges ?? []
    const upcomingInstallments: UpcomingInstallment[] = unbilledResult?.upcoming_installments ?? []
    const unbilledSummary = unbilledResult?.summary
    const forecast = unbilledResult?.forecast

    // ── Computed values ────────────────────────────
    return useMemo(() => {
        const totalDebt = analytics
            ? parseFloat(analytics.summary.total_debt)
            : 0
        const totalUnbilled = analytics
            ? parseFloat(analytics.summary.total_unbilled)
            : 0
        const totalCombined = totalDebt + totalUnbilled

        const overdueCount = analytics?.summary.overdue_statements ?? 0
        const openCount = analytics?.summary.open_statements ?? 0

        // Financial cost trend: current vs previous month
        const costs = analytics?.financial_costs ?? []
        let financialCostsTrend: TcTrendData = { direction: "up", value: "—" }
        if (costs.length >= 2) {
            const curr = parseFloat(costs[costs.length - 1]?.total ?? "0")
            const prev = parseFloat(costs[costs.length - 2]?.total ?? "0")
            financialCostsTrend = {
                direction: curr >= prev ? "up" : "down",
                value: prev > 0 ? `${Math.round(((curr - prev) / prev) * 100)}%` : "—",
            }
        }

        // Payment performance chart (debt trend over time)
        const payments = analytics?.payment_performance ?? []
        const paymentPerformanceChart = [{
            id: "Saldo Pendiente",
            data: [...payments]
                .reverse()
                .map(p => ({
                    x: p.due_date,
                    y: parseFloat(p.outstanding),
                })),
        }]

        // Financial costs chart data (parsed to numbers)
        const financialCostsChart = costs.map(c => ({
            period: c.period,
            interest: parseFloat(c.interest),
            fees: parseFloat(c.fees),
            total: parseFloat(c.total),
        }))

        // Credit utilization history (from forecast by_month)
        const utilizationHistory: Array<{ period: string; used: number; limit: number }> = []
        if (forecast?.by_month && forecast.credit_limit) {
            const limit = parseFloat(forecast.credit_limit)
            for (const [key, val] of Object.entries(forecast.by_month)) {
                const d = new Date(key + "-02")
                const period = d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" })
                utilizationHistory.push({
                    period,
                    used: parseFloat(val.total) + parseFloat(forecast.current_debt),
                    limit,
                })
            }
        }

        // Next upcoming payments timeline
        const now = todayStr
        const upcoming: TcTimelineEvent[] = []

        // Add upcoming installments due
        for (const inst of upcomingInstallments) {
            if (inst.due_date >= now) {
                upcoming.push({
                    date: new Date(inst.due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
                    label: `${inst.partner_name ?? "Proveedor"} · Cuota ${inst.number}/${inst.total_installments}`,
                    description: `$${Number(inst.principal_amount).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`,
                    status: inst.due_date === now ? "warning" : "neutral",
                })
            }
        }

        // Add statement due dates
        for (const stmt of analytics?.payment_performance ?? []) {
            if (stmt.status === "OPEN" || stmt.status === "OVERDUE") {
                upcoming.push({
                    date: new Date(stmt.due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
                    label: `${stmt.display_id} · ${stmt.status === "OVERDUE" ? "VENCIDO" : "Por vencer"}`,
                    description: `$${parseFloat(stmt.outstanding).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`,
                    status: stmt.status === "OVERDUE" ? "destructive"
                        : stmt.status === "OPEN" ? "warning"
                        : "neutral",
                })
            }
        }

        upcoming.sort((a, b) => {
            const parseDate = (s: string) => {
                const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
                const parts = s.replace(".", "").split(" ")
                return new Date(2026, months.indexOf(parts[1]?.toLowerCase() ?? ""), parseInt(parts[0] ?? "1")).getTime()
            }
            return parseDate(a.date) - parseDate(b.date)
        })

        return {
            analytics,
            analyticsLoading,
            charges,
            upcomingInstallments,
            forecast,
            unbilledSummary,
            unbilledLoading,
            totalDebt,
            totalUnbilled,
            totalCombined,
            overdueCount,
            openCount,
            financialCostsTrend,
            paymentPerformanceChart,
            financialCostsChart,
            creditUtilizationHistory: utilizationHistory,
            nextUpcomingPayments: upcoming.slice(0, 15),
            granularity,
            dateRange,
        }
    }, [analytics, analyticsLoading, charges, upcomingInstallments, forecast, unbilledSummary, unbilledLoading, todayStr])
}
