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
        const payments = analytics?.payment_performance ?? []
        const groups = analytics?.purchase_group_analysis ?? []
        const costs = analytics?.financial_costs ?? []

        const sortedPayments = [...payments]
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

        const paymentEvolutionChart = [
            {
                id: 'Total a Pagar',
                data: sortedPayments.map(p => ({ x: p.due_date, y: parseFloat(p.total_to_pay) })),
            },
            {
                id: 'Monto Pagado',
                data: sortedPayments.map(p => ({ x: p.due_date, y: parseFloat(p.amount_paid) })),
            },
        ]

        const purchaseGroupData = [...groups]
            .sort((a, b) => (b.effective_cost_pct ?? 0) - (a.effective_cost_pct ?? 0))

        const totalAmount = groups.reduce((sum, g) => sum + parseFloat(g.total_amount), 0)
        const totalInterest = groups.reduce((sum, g) => sum + parseFloat(g.total_interest), 0)
        const totalFees = costs.reduce((sum, c) => sum + parseFloat(c.fees), 0)

        const costBreakdownDonut = [
            { id: 'Capital', value: totalAmount, color: 'var(--chart-1)' },
            { id: 'Intereses', value: totalInterest, color: 'var(--chart-2)' },
            { id: 'Comisiones', value: totalFees, color: 'var(--chart-3)' },
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
