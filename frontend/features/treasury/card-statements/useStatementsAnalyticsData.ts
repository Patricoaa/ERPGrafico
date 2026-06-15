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
        const totalBilled = analytics?.summary?.total_billed ? parseFloat(analytics.summary.total_billed) : 0

        const otherCharges = Math.max(0, totalBilled - totalPrincipal)

        const costBreakdownDonut = [
            { id: 'Cuotas', value: totalPrincipal, color: 'var(--chart-1)' },
            ...(otherCharges > 0 ? [{ id: 'Otros Cargos', value: otherCharges, color: 'var(--chart-4)' as string }] : []),
            ...(totalCharges > 0 ? [{ id: 'Intereses/Comisiones', value: totalCharges, color: 'var(--chart-3)' as string }] : []),
        ]

        return {
            analytics,
            analyticsLoading,
            paymentEvolutionChart,
            purchaseGroupData,
            costBreakdownDonut,
        }
    }, [analytics, analyticsLoading])
}
