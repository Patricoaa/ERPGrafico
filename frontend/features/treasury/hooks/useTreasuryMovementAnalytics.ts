"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { treasuryApi } from "../api/treasuryApi"
import type {
    TreasuryMovementAnalyticsParams,
    TreasuryMovementAnalyticsResponse,
    TreasuryMovementSummaryKpis,
} from "../analyticsTypes"
import { formatMonth } from "@/lib/analytics-helpers"
import { assignChartColors } from "@/lib/chart-colors"

export interface PieChartItem {
    id: string
    value: number
    color?: string
}

export interface TreasuryMovementAnalyticsData {
    analytics: TreasuryMovementAnalyticsResponse | undefined
    analyticsLoading: boolean
    flowLineChart: Array<{ id: string; data: Array<{ x: string; y: number }> }>
    accountBar: Record<string, string | number>[]
    paymentMethodPie: PieChartItem[]
    typePie: PieChartItem[]
    summary: TreasuryMovementSummaryKpis | undefined
}

function formatPeriodKey(period: string, granularity: string): string {
    if (granularity === "day") {
        const [, m, d] = period.split("-")
        return `${d}/${m}`
    }
    if (granularity === "year") return period
    return formatMonth(`${period}-01`)
}

export function useTreasuryMovementAnalytics(
    params: TreasuryMovementAnalyticsParams = {},
): TreasuryMovementAnalyticsData {
    const granularity = params.granularity ?? "month"

    const {
        data: analytics,
        isLoading: analyticsLoading,
    } = useQuery({
        queryKey: [
            "treasury",
            "movements",
            "analytics",
            params.months ?? 12,
            granularity,
            params.treasury_account ?? null,
            params.bank ?? null,
            params.movement_type ?? null,
            params.payment_method ?? null,
            params.amount_min ?? null,
            params.amount_max ?? null,
            params.date_from ?? null,
            params.date_to ?? null,
        ],
        queryFn: () => treasuryApi.getMovementAnalytics(params),
        staleTime: 5 * 60 * 1000,
    })

    return useMemo(() => {
        const flow = analytics?.flow_trend ?? []
        const accounts = analytics?.account_distribution ?? []
        const paymentMethods = analytics?.payment_method_distribution ?? []
        const types = analytics?.type_distribution ?? []

        const flowLineChart = [
            {
                id: "Ingresos",
                data: flow.map(row => ({ x: formatPeriodKey(row.period, granularity), y: parseFloat(row.ingresos) })),
            },
            {
                id: "Egresos",
                data: flow.map(row => ({ x: formatPeriodKey(row.period, granularity), y: parseFloat(row.egresos) })),
            },
            {
                id: "Ajustes",
                data: flow.map(row => ({ x: formatPeriodKey(row.period, granularity), y: parseFloat(row.ajustes) })),
            },
            {
                id: "Transferencias",
                data: flow.map(row => ({ x: formatPeriodKey(row.period, granularity), y: parseFloat(row.transferencias) })),
            },
        ]

        const accountBar = accounts
            .map(a => ({
                cuenta: a.account_name,
                ingresos: parseFloat(a.in),
                egresos: parseFloat(a.out),
            }))

        const paymentMethodPie: PieChartItem[] = assignChartColors(
            paymentMethods.filter(p => p.count > 0).map(p => ({ id: p.label, value: p.count })),
        )

        const typePie: PieChartItem[] = assignChartColors(
            types.filter(t => t.count > 0).map(t => ({ id: t.label, value: t.count })),
        )

        return {
            analytics,
            analyticsLoading,
            flowLineChart,
            accountBar,
            paymentMethodPie,
            typePie,
            summary: analytics?.summary,
        }
    }, [analytics, analyticsLoading, granularity])
}
