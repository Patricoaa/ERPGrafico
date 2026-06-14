"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { treasuryApi } from "../api/treasuryApi"
import type { TcHubAnalyticsResponse } from "./analyticsTypes"

export interface TcTrendData {
    direction: "up" | "down"
    value: string
}

export interface StatementsAnalyticsData {
    analytics: TcHubAnalyticsResponse | undefined
    analyticsLoading: boolean
    paymentPerformanceChart: Array<{ id: string; data: Array<{ x: string; y: number }> }>
    financialCostsChart: Array<{ period: string; interest: number; fees: number; total: number }>
    financialCostsTrend: TcTrendData
}

export function useStatementsAnalyticsData(
    cardAccountId: number | null,
    months: number = 12,
): StatementsAnalyticsData {
    const {
        data: analytics,
        isLoading: analyticsLoading,
    } = useQuery({
        queryKey: ['card-analytics', cardAccountId, months],
        queryFn: () => treasuryApi.getCardAnalytics({
            card_account: cardAccountId ?? undefined,
            months,
        }),
        enabled: cardAccountId != null,
    })

    return useMemo(() => {
        const costs = analytics?.financial_costs ?? []
        const payments = analytics?.payment_performance ?? []

        let financialCostsTrend: TcTrendData = { direction: "up", value: "—" }
        if (costs.length >= 2) {
            const curr = parseFloat(costs[costs.length - 1]?.total ?? "0")
            const prev = parseFloat(costs[costs.length - 2]?.total ?? "0")
            financialCostsTrend = {
                direction: curr >= prev ? "up" : "down",
                value: prev > 0 ? `${Math.round(((curr - prev) / prev) * 100)}%` : "—",
            }
        }

        const paymentPerformanceChart = [{
            id: "Saldo Pendiente",
            data: [...payments]
                .reverse()
                .map(p => ({
                    x: p.due_date,
                    y: parseFloat(p.outstanding),
                })),
        }]

        const financialCostsChart = costs.map(c => ({
            period: c.period,
            interest: parseFloat(c.interest),
            fees: parseFloat(c.fees),
            total: parseFloat(c.total),
        }))

        return {
            analytics,
            analyticsLoading,
            paymentPerformanceChart,
            financialCostsChart,
            financialCostsTrend,
        }
    }, [analytics, analyticsLoading])
}
