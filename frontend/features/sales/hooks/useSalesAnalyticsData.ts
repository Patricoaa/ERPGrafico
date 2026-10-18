"use client"

import { useQuery } from "@tanstack/react-query"
import { assignChartColors } from "@/lib/chart-colors"
import { granularityKey } from "@/lib/analytics-helpers"
import type { Granularity } from "@/lib/analytics-helpers"
import { staleTime } from "@/lib/query-config"
import { salesApi, type SaleOrderAnalyticsResponse } from "../api/salesApi"
import type { SaleOrderFilters } from "../types"
import { SALES_KEYS } from "./queryKeys"

export interface TrendData {
    direction: "up" | "down"
    value: string
}

export interface SalesAnalyticsData {
    totalVolume: number
    totalPaid: number
    totalPending: number
    orderCount: number
    avgOrderValue: number
    customerCount: number
    deliveredCount: number
    pendingDeliveryCount: number
    posOrderCount: number
    systemOrderCount: number
    volumeTrend: TrendData
    paidTrend: TrendData
    orderCountTrend: TrendData
    avgOrderValueTrend: TrendData
    channelDistribution: Array<{ id: string; value: number; color: string }>
    paymentMethodDistribution: Array<{ id: string; value: number; color: string }>
    deliveryStatusDistribution: Array<{ id: string; value: number; color: string }>
    monthlyVolume: Array<{ month: string; total: number }>
    monthlyCount: Array<{ month: string; count: number }>
    monthlyNet: Array<{ month: string; net: number }>
    topCustomers: Array<{ customer: string; total: number; orderCount: number }>
    customerDistribution: Array<{ id: string; value: number; color: string }>
    topProducts: Array<{ product: string; total: number; count: number }>
    productTypeBreakdown: Array<{ id: string; value: number; color: string }>
    channelTrend: Array<{ month: string; system: number; pos: number }>
    monthlyDeliveries: Array<{ month: string; count: number }>
    priceRangeDistribution: Array<{ id: string; value: number; color: string }>
}

function trend(current: number, previous: number): TrendData {
    return {
        direction: current >= previous ? "up" : "down",
        value: previous > 0 ? `${Math.round(((current - previous) / previous) * 100)}%` : "—",
    }
}

/** Server figures (ids already labelled by the model choices) → chart colors, trends and period labels. */
function toSalesAnalyticsData(data: SaleOrderAnalyticsResponse): SalesAnalyticsData {
    const g = data.granularity
    const period = (bucket: string) => granularityKey(bucket, g)
    const { current, previous } = data.trend
    const avg = (t: { volume: number; count: number }) => (t.count > 0 ? t.volume / t.count : 0)
    const customers = data.customers.map((c) => ({ customer: c.customer || "Desconocido", total: c.total, orderCount: c.order_count }))
    return {
        totalVolume: data.totals.total_volume,
        totalPaid: data.totals.total_paid,
        totalPending: data.totals.total_pending,
        orderCount: data.totals.order_count,
        avgOrderValue: data.totals.avg_order_value,
        customerCount: data.totals.customer_count,
        deliveredCount: data.totals.delivered_count,
        pendingDeliveryCount: data.totals.pending_delivery_count,
        posOrderCount: data.totals.pos_order_count,
        systemOrderCount: data.totals.system_order_count,
        volumeTrend: trend(current.volume, previous.volume),
        paidTrend: trend(current.paid, previous.paid),
        orderCountTrend: trend(current.count, previous.count),
        avgOrderValueTrend: trend(avg(current), avg(previous)),
        channelDistribution: assignChartColors(data.channel),
        paymentMethodDistribution: assignChartColors(data.payment_method),
        deliveryStatusDistribution: assignChartColors(data.delivery_status),
        monthlyVolume: data.periods.map((p) => ({ month: period(p.bucket), total: p.total })),
        monthlyCount: data.periods.map((p) => ({ month: period(p.bucket), count: p.count })),
        monthlyNet: data.periods.map((p) => ({ month: period(p.bucket), net: p.net })),
        topCustomers: customers.slice(0, 10),
        customerDistribution: assignChartColors(customers.map((c) => ({ id: c.customer, value: c.total }))),
        topProducts: data.products.map((p) => ({ product: p.product || "Sin nombre", total: p.total, count: p.count })),
        productTypeBreakdown: assignChartColors(data.product_types),
        channelTrend: data.periods.map((p) => ({ month: period(p.bucket), system: p.system, pos: p.pos })),
        monthlyDeliveries: data.periods.map((p) => ({ month: period(p.bucket), count: p.delivered })),
        priceRangeDistribution: assignChartColors(data.price_ranges),
    }
}

/** Zeros while the figures load (the tabs render their layout instead of jumping). */
export const EMPTY_SALES_ANALYTICS: SalesAnalyticsData = toSalesAnalyticsData({
    granularity: "month",
    totals: { total_volume: 0, total_paid: 0, total_pending: 0, order_count: 0, avg_order_value: 0, customer_count: 0, delivered_count: 0, pending_delivery_count: 0, pos_order_count: 0, system_order_count: 0 },
    trend: { current: { volume: 0, paid: 0, count: 0 }, previous: { volume: 0, paid: 0, count: 0 } },
    channel: [], payment_method: [], delivery_status: [], customers: [], products: [], product_types: [], periods: [], price_ranges: [],
})

/**
 * Sale order analytics over the **whole filtered list** (ADR-0087 lote 2b), not the visible page:
 * the backend aggregates with the same filters as the list endpoint.
 */
export function useSaleOrderAnalytics({ filters, granularity, enabled = true }: { filters?: SaleOrderFilters; granularity: Granularity; enabled?: boolean }) {
    const query = useQuery({
        queryKey: SALES_KEYS.orderAnalytics(filters, granularity),
        queryFn: () => salesApi.getOrderAnalytics(filters, granularity),
        staleTime: staleTime.standard,
        enabled,
        select: toSalesAnalyticsData,
        placeholderData: (prev) => prev,
    })
    return { analytics: query.data ?? null, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}
