"use client"

import { useQuery } from "@tanstack/react-query"
import { assignChartColors } from "@/lib/chart-colors"
import { granularityKey } from "@/lib/analytics-helpers"
import type { Granularity } from "@/lib/analytics-helpers"
import { staleTime } from "@/lib/query-config"
import { useAuth } from "@/contexts/AuthContext"
import { purchasingApi, type OrderFilters, type PurchaseOrderAnalyticsResponse } from "../api/purchasingApi"
import { PURCHASING_KEYS } from "./queryKeys"

const FUNNEL_LABELS: Record<string, string> = {
    DRAFT: "Borrador",
    CONFIRMED: "Confirmada",
    RECEIVED: "Recibida",
    INVOICED: "Facturada",
    PAID: "Pagada",
}

// ── Public interface ──────────────────────────────────────

type Distribution = Array<{ id: string; value: number; color: string }>

export interface ProductTypeAnalytics {
    topProducts: Array<{ product: string; total: number; count: number }>
    monthlyTrend: Array<{ month: string; total: number }>
    categoryDistribution: Distribution
    totalVolume: number
    orderCount: number
}

export interface PurchasingAnalyticsData {
    totalVolume: number
    orderCount: number
    overdueCount: number
    pendingReceiptCount: number
    onTimeCount: number
    lateCount: number
    funnel: Array<{ id: string; label: string; value: number; color: string }>
    paymentMethodDistribution: Distribution
    topSuppliers: Array<{ supplier: string; total: number; orderCount: number }>
    monthlyVolume: Array<{ month: string; total: number }>
    monthlyAvg: Array<{ month: string; avg: number }>
    ordersByWarehouse: Array<{ warehouse: string; count: number }>
    topProductsByVolume: Array<{ product: string; total: number }>
    categoryDistribution: Distribution
    dteDistribution: Distribution
    invoicedVolumeData: Distribution
    invoicedStatusSummary: { invoicedCount: number; invoicedVolume: number }
    storableData: ProductTypeAnalytics
    serviceData: ProductTypeAnalytics
    subscriptionData: ProductTypeAnalytics
    totalLineVolume: number
}

type Breakdown = PurchaseOrderAnalyticsResponse["by_type"]["storable"]

/** Server figures (payment ids already labelled by the model choices) → chart colors, funnel and period labels. */
function toPurchasingAnalyticsData(data: PurchaseOrderAnalyticsResponse): PurchasingAnalyticsData {
    const period = (bucket: string) => granularityKey(bucket, data.granularity)
    const { totals, invoiced } = data
    const byType = (b: Breakdown): ProductTypeAnalytics => ({
        topProducts: b.top_products,
        monthlyTrend: b.periods.map((p) => ({ month: period(p.bucket), total: p.total })),
        categoryDistribution: assignChartColors(b.categories),
        totalVolume: b.total_volume,
        orderCount: b.order_count,
    })
    return {
        totalVolume: totals.total_volume,
        orderCount: totals.order_count,
        overdueCount: totals.overdue_count,
        pendingReceiptCount: totals.pending_receipt_count,
        onTimeCount: totals.on_time_count,
        lateCount: totals.late_count,
        funnel: assignChartColors(data.funnel.map((s) => ({ ...s, label: FUNNEL_LABELS[s.id] ?? s.id }))),
        paymentMethodDistribution: assignChartColors(data.payment_method),
        topSuppliers: data.top_suppliers.map((s) => ({ supplier: s.supplier, total: s.total, orderCount: s.order_count })),
        monthlyVolume: data.periods.map((p) => ({ month: period(p.bucket), total: p.total })),
        monthlyAvg: data.periods.map((p) => ({ month: period(p.bucket), avg: p.count > 0 ? p.total / p.count : 0 })),
        ordersByWarehouse: data.warehouses,
        topProductsByVolume: data.top_products,
        categoryDistribution: assignChartColors(data.product_types),
        dteDistribution: assignChartColors(data.dte),
        invoicedVolumeData: assignChartColors([
            { id: "Facturado", value: invoiced.invoiced_volume },
            { id: "Sin Facturar", value: invoiced.pending_volume },
        ]),
        invoicedStatusSummary: { invoicedCount: invoiced.invoiced_count, invoicedVolume: invoiced.invoiced_volume },
        storableData: byType(data.by_type.storable),
        serviceData: byType(data.by_type.service),
        subscriptionData: byType(data.by_type.subscription),
        totalLineVolume: totals.total_line_volume,
    }
}

const EMPTY_BREAKDOWN: Breakdown = { top_products: [], periods: [], categories: [], total_volume: 0, order_count: 0 }

/** Zeros while the figures load (the tabs render their layout instead of jumping). */
export const EMPTY_PURCHASING_ANALYTICS: PurchasingAnalyticsData = toPurchasingAnalyticsData({
    granularity: "month",
    totals: { total_volume: 0, order_count: 0, overdue_count: 0, pending_receipt_count: 0, on_time_count: 0, late_count: 0, total_line_volume: 0 },
    funnel: [], payment_method: [], top_suppliers: [], periods: [], warehouses: [], top_products: [], product_types: [], dte: [],
    invoiced: { invoiced_count: 0, invoiced_volume: 0, pending_volume: 0 },
    by_type: { storable: EMPTY_BREAKDOWN, service: EMPTY_BREAKDOWN, subscription: EMPTY_BREAKDOWN },
})

/**
 * Purchase order analytics over the **whole filtered list** (ADR-0087 lote 2c), not the visible
 * page: the backend aggregates with the same filters as the list endpoint.
 */
export function usePurchaseOrderAnalytics({ filters, granularity, enabled = true }: { filters?: OrderFilters; granularity: Granularity; enabled?: boolean }) {
    const { isAuthenticated } = useAuth()
    const query = useQuery({
        queryKey: PURCHASING_KEYS.orderAnalytics(filters, granularity),
        queryFn: () => purchasingApi.getOrderAnalytics(filters, granularity),
        staleTime: staleTime.standard,
        enabled: enabled && isAuthenticated,
        select: toPurchasingAnalyticsData,
        placeholderData: (prev) => prev,
    })
    return { analytics: query.data ?? null, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}
