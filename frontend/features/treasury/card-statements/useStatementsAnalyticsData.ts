"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { treasuryApi } from "../api/treasuryApi"
import type { TcHubAnalyticsResponse, PurchaseGroupAnalysisRow } from "./analyticsTypes"

export interface CostDonutItem {
    id: string
    value: number
    color: string
}

export interface StatementsAnalyticsData {
    analytics: TcHubAnalyticsResponse | undefined
    analyticsLoading: boolean
    paymentEvolutionChart: Array<{ id: string; data: Array<{ x: string; y: number }> }>
    purchaseGroupData: PurchaseGroupAnalysisRow[]
    costBreakdownDonut: CostDonutItem[]
}

export function useStatementsAnalyticsData(
    cardAccountId: number | null,
    months: number = 12,
    granularity: string = 'month',
): StatementsAnalyticsData {
    const {
        data: analytics,
        isLoading: analyticsLoading,
    } = useQuery({
        queryKey: ['card-analytics', cardAccountId, months, granularity],
        queryFn: () => treasuryApi.getCardAnalytics({
            card_account: cardAccountId ?? undefined,
            months,
            granularity,
        }),
        enabled: cardAccountId != null,
    })

    return useMemo(() => {
        const payments = analytics?.payment_performance ?? []
        const groups = analytics?.purchase_group_analysis ?? []
        const costs = analytics?.financial_costs ?? []

        const sortedPayments = [...payments]
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

        const paymentEvolutionChart = [
            {
                id: 'Monto Pagado',
                data: sortedPayments.map(p => ({ x: p.due_date, y: parseFloat(p.amount_paid) })),
            },
        ]

        const purchaseGroupData = [...groups]
            .sort((a, b) => (b.effective_cost_pct ?? 0) - (a.effective_cost_pct ?? 0))

        const totalPrincipal = groups.reduce((sum, g) => sum + parseFloat(g.total_amount), 0)
        const totalCharges = costs.reduce((sum, c) => sum + parseFloat(c.fees) + parseFloat(c.interest), 0)

        const costBreakdownDonut = [
            { id: 'Cuotas', value: totalPrincipal, color: 'var(--chart-1)' },
            { id: 'Cargos', value: totalCharges, color: 'var(--chart-3)' },
        ].filter(d => d.value > 0)

        return {
            analytics,
            analyticsLoading,
            paymentEvolutionChart,
            purchaseGroupData,
            costBreakdownDonut,
        }
    }, [analytics, analyticsLoading])
}
