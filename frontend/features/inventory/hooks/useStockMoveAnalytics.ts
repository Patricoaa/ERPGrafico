"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type {
    StockMoveAnalyticsParams,
    StockMoveAnalyticsResponse,
    StockMoveSummaryKpis,
} from "../analyticsTypes"
import { formatMonth } from "@/lib/analytics-helpers"
import { assignChartColors } from "@/lib/chart-colors"

export interface PieChartItem {
    id: string
    value: number
    color?: string
}

export interface StockMoveAnalyticsData {
    analytics: StockMoveAnalyticsResponse | undefined
    analyticsLoading: boolean
    flowLineChart: Array<{ id: string; data: Array<{ x: string; y: number }> }>
    topProductsBar: Record<string, string | number>[]
    categoryPie: PieChartItem[]
    locationBar: Record<string, string | number>[]
    summary: StockMoveSummaryKpis | undefined
}

function formatPeriodKey(period: string, granularity: string): string {
    if (granularity === "day") {
        const [, m, d] = period.split("-")
        return `${d}/${m}`
    }
    if (granularity === "year") return period
    return formatMonth(`${period}-01`)
}

export function useStockMoveAnalytics(params: StockMoveAnalyticsParams = {}): StockMoveAnalyticsData {
    const granularity = params.granularity ?? "month"

    const {
        data: analytics,
        isLoading: analyticsLoading,
    } = useQuery({
        queryKey: [
            "inventory",
            "stockMoves",
            "analytics",
            params.months ?? 12,
            granularity,
            params.product_id ?? null,
            params.product_name ?? null,
            params.source_location_id ?? null,
            params.destination_location_id ?? null,
            params.date_from ?? null,
            params.date_to ?? null,
        ],
        queryFn: () => inventoryApi.getStockMoveAnalytics(params),
        staleTime: 5 * 60 * 1000,
    })

    return useMemo(() => {
        const flow = analytics?.flow_trend ?? []
        const topProducts = analytics?.top_products ?? []
        const categories = analytics?.category_distribution ?? []
        const locations = analytics?.location_distribution ?? []

        const flowLineChart = [
            {
                id: "Entradas",
                data: flow.map(row => ({ x: formatPeriodKey(row.period, granularity), y: parseFloat(row.entradas) })),
            },
            {
                id: "Salidas",
                data: flow.map(row => ({ x: formatPeriodKey(row.period, granularity), y: parseFloat(row.salidas) })),
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

        const topProductsBar = [...topProducts]
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, 8)
            .map(p => ({ producto: p.product_name, valor: parseFloat(p.amount) }))

        const categoryPie: PieChartItem[] = assignChartColors(
            categories.filter(c => c.value > 0).map(c => ({ id: c.id, value: c.value })),
        )

        const locationBar = locations.map(l => ({
            ubicacion: l.id,
            movimientos: l.value,
            entradas: l.in,
            salidas: l.out,
        }))

        return {
            analytics,
            analyticsLoading,
            flowLineChart,
            topProductsBar,
            categoryPie,
            locationBar,
            summary: analytics?.summary,
        }
    }, [analytics, analyticsLoading, granularity])
}
