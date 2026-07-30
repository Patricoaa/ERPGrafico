"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { treasuryApi } from "../api/treasuryApi"
import { parseDateOnly } from "@/lib/utils"
import { assignChartColors } from "@/lib/chart-colors"
import type {
    TcHubAnalyticsResponse,
    PaymentPerformanceRow,
    FinancialCostsByMonth,
    CreditUtilizationRow,
    PurchaseGroupAnalysisRow,
    TcSummaryKpis,
} from "../card-statements/analyticsTypes"

export interface CostDonutItem {
    id: string
    value: number
    color: string
}

export interface StatementsAnalyticsData {
    analytics: TcHubAnalyticsResponse | undefined
    analyticsLoading: boolean
    paymentPerformance: PaymentPerformanceRow[]
    financialCosts: FinancialCostsByMonth[]
    creditUtilization: CreditUtilizationRow[]
    purchaseGroupData: PurchaseGroupAnalysisRow[]
    summary: TcSummaryKpis | undefined
    paymentEvolutionChart: Array<{ id: string; data: Array<{ x: string; y: number }> }>
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
        staleTime: 5 * 60 * 1000,
        enabled: cardAccountId != null,
    })

    return useMemo(() => {
        const payments = analytics?.payment_performance ?? []
        const groups = analytics?.purchase_group_analysis ?? []
        const costs = analytics?.financial_costs ?? []

        const sortedPayments = [...payments]
            .sort((a, b) => parseDateOnly(a.due_date).getTime() - parseDateOnly(b.due_date).getTime())

        const paymentEvolutionChart = [
            {
                id: 'Monto a Pagar',
                data: sortedPayments.map(p => ({ x: p.due_date, y: parseFloat(p.total_to_pay) })),
            },
            {
                id: 'Monto Pagado',
                data: sortedPayments.map(p => ({ x: p.due_date, y: parseFloat(p.amount_paid) })),
            },
        ]

        const purchaseGroupData = [...groups]
            .sort((a, b) => (b.effective_cost_pct ?? 0) - (a.effective_cost_pct ?? 0))

        const totalPrincipal = groups.reduce((sum, g) => sum + parseFloat(g.total_amount), 0)
        const totalCharges = costs.reduce((sum, c) => sum + parseFloat(c.fees) + parseFloat(c.interest), 0)

        const costBreakdownDonut = assignChartColors([
            { id: 'Capital', value: totalPrincipal },
            ...(totalCharges > 0 ? [{ id: 'Intereses y Comisiones', value: totalCharges }] : []),
        ])

        return {
            analytics,
            analyticsLoading,
            paymentPerformance: payments,
            financialCosts: costs,
            creditUtilization: analytics?.credit_utilization ?? [],
            purchaseGroupData,
            summary: analytics?.summary,
            paymentEvolutionChart,
            costBreakdownDonut,
        }
    }, [analytics, analyticsLoading, granularity])
}
