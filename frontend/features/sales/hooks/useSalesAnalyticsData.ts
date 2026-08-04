"use client"

import { useMemo } from "react"
import type { SaleOrder } from "../types"
import { assignChartColors } from "@/lib/chart-colors"
import { groupBy, granularityKey, granularitySortValue } from "@/lib/analytics-helpers"
import type { Granularity } from "@/lib/analytics-helpers"

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    CHECK: "Cheque",
    CREDIT: "Crédito",
    CREDIT_BALANCE: "Saldo a Favor",
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente",
    PARTIAL: "Parcial",
    DELIVERED: "Entregado",
}

export function useSalesAnalyticsData(
    orders: SaleOrder[],
    dateRange?: { from: string; to: string } | null,
    granularity?: Granularity,
): SalesAnalyticsData {
    return useMemo(() => {
        const safeOrders = Array.isArray(orders) ? orders : []
        let filtered = safeOrders
        if (dateRange) {
            filtered = filtered.filter((o) => {
                if (!o.date) return false
                return o.date >= dateRange.from && o.date <= dateRange.to
            })
        }

        const g = granularity ?? "month"
        const keyFn = (o: SaleOrder) => granularityKey(o.date || "", g)

        const orderCount = filtered.length
        const totalVolume = filtered.reduce((s, o) => s + Number(o.total || 0), 0)
        const totalPaid = filtered.reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const totalPending = filtered.reduce((s, o) => s + Number(o.pending_amount || 0), 0)
        const avgOrderValue = orderCount > 0 ? totalVolume / orderCount : 0
        const customerNames = new Set(filtered.map((o) => o.customer_name).filter(Boolean))
        const customerCount = customerNames.size

        const deliveredCount = filtered.filter((o) => o.delivery_status === "DELIVERED").length
        const pendingDeliveryCount = filtered.filter((o) => o.delivery_status !== "DELIVERED" && o.status !== "CANCELLED").length
        const posOrderCount = filtered.filter((o) => o.channel_display === "Punto de Venta (POS)").length
        const systemOrderCount = filtered.filter((o) => o.channel_display === "Sistema").length

        const channelGroups = groupBy(filtered, (o) => o.channel_display || "Sistema")
        const channelDistribution = assignChartColors(
            Object.entries(channelGroups)
                .map(([id, items]) => ({ id, value: items.length }))
                .sort((a, b) => b.value - a.value),
        )

        const paymentMethodGroups = groupBy(filtered, (o) => {
            if (o.pos_session) return "POS (Efectivo/Tarjeta)"
            const pm = o.payment_method ?? ""
            return PAYMENT_METHOD_LABELS[pm] ?? o.payment_method ?? "Sin método"
        })
        const paymentMethodDistribution = assignChartColors(
            Object.entries(paymentMethodGroups)
                .map(([id, items]) => ({ id, value: items.length }))
                .sort((a, b) => b.value - a.value),
        )

        const deliveryGroups = groupBy(filtered, (o) => o.delivery_status || "PENDING")
        const deliveryStatusDistribution = assignChartColors(
            Object.entries(deliveryGroups)
                .map(([id, items]) => ({ id: DELIVERY_STATUS_LABELS[id] ?? id, value: items.length }))
                .sort((a, b) => b.value - a.value),
        )

        const periodGroups = groupBy(filtered, keyFn)
        const sortedPeriods = Object.keys(periodGroups).sort((a, b) => granularitySortValue(a, g) - granularitySortValue(b, g))

        const monthlyVolume = sortedPeriods.map((period) => ({
            month: period,
            total: periodGroups[period].reduce((s, o) => s + Number(o.total || 0), 0),
        }))

        const monthlyCount = sortedPeriods.map((period) => ({
            month: period,
            count: periodGroups[period].length,
        }))

        const monthlyNet = sortedPeriods.map((period) => ({
            month: period,
            net: periodGroups[period].reduce((s, o) => s + Number(o.total_net || 0), 0),
        }))

        const customerGroups = groupBy(filtered, (o) => o.customer_name || "Desconocido")
        const customerAggs = Object.entries(customerGroups)
            .map(([customer, items]) => ({
                customer,
                total: items.reduce((s, o) => s + Number(o.total || 0), 0),
                orderCount: items.length,
            }))
            .sort((a, b) => b.total - a.total)

        const topCustomers = customerAggs.slice(0, 10)
        const customerDistribution = assignChartColors(
            customerAggs.map((s) => ({ id: s.customer, value: s.total })),
        )

        const productStats: Record<string, { total: number; count: number }> = {}
        const typeStats: Record<string, number> = {}
        filtered.forEach((order) => {
            if (!Array.isArray(order.lines)) return
            order.lines.forEach((line) => {
                const lineTotal = Number(line.subtotal || 0)
                if (!lineTotal) return
                const name = line.product_name || "Sin nombre"
                if (!productStats[name]) productStats[name] = { total: 0, count: 0 }
                productStats[name].total += lineTotal
                productStats[name].count += Number(line.quantity || 0)
                const cat = line.product_type || "General"
                typeStats[cat] = (typeStats[cat] || 0) + lineTotal
            })
        })

        const topProducts = Object.entries(productStats)
            .map(([product, s]) => ({ product, total: s.total, count: s.count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)

        const productTypeLabels: Record<string, string> = {
            STORABLE: "Almacenable",
            CONSUMABLE: "Consumible",
            MANUFACTURABLE: "Fabricable",
            SERVICE: "Servicio",
            SUBSCRIPTION: "Suscripción",
        }
        const productTypeBreakdown = assignChartColors(
            Object.entries(typeStats)
                .map(([id, value]) => ({ id: productTypeLabels[id] ?? id, value }))
                .sort((a, b) => b.value - a.value),
        )

        const channelTrend = sortedPeriods.map((period) => ({
            month: period,
            system: periodGroups[period]
                .filter((o) => o.channel_display !== "Punto de Venta (POS)")
                .reduce((s, o) => s + Number(o.total || 0), 0),
            pos: periodGroups[period]
                .filter((o) => o.channel_display === "Punto de Venta (POS)")
                .reduce((s, o) => s + Number(o.total || 0), 0),
        }))

        const monthlyDeliveries = sortedPeriods.map((period) => ({
            month: period,
            count: periodGroups[period].filter((o) => o.delivery_status === "DELIVERED").length,
        }))

        function inPeriod(o: SaleOrder, periodVal: number, localG: "day" | "month" | "year"): boolean {
            if (!o.date) return false
            const d = new Date(o.date)
            if (localG === "year") return d.getFullYear() === periodVal
            if (localG === "day") return Math.floor(d.getTime() / 86_400_000) === periodVal
            return d.getMonth() + d.getFullYear() * 12 === periodVal
        }

        const _now = new Date()
        const currPeriod = g === "year" ? _now.getFullYear() : g === "day" ? Math.floor(_now.getTime() / 86_400_000) : _now.getMonth() + _now.getFullYear() * 12
        const prevPeriod = currPeriod - 1
        const inCurr = (o: SaleOrder) => inPeriod(o, currPeriod, g)
        const inPrev = (o: SaleOrder) => inPeriod(o, prevPeriod, g)

        const currVol = safeOrders.filter(inCurr).reduce((s, o) => s + Number(o.total || 0), 0)
        const prevVol = safeOrders.filter(inPrev).reduce((s, o) => s + Number(o.total || 0), 0)
        const volumeTrend: TrendData = { direction: currVol >= prevVol ? "up" : "down", value: prevVol > 0 ? `${Math.round(((currVol - prevVol) / prevVol) * 100)}%` : "—" }

        const currPaid = safeOrders.filter(inCurr).reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const prevPaid = safeOrders.filter(inPrev).reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const paidTrend: TrendData = { direction: currPaid >= prevPaid ? "up" : "down", value: prevPaid > 0 ? `${Math.round(((currPaid - prevPaid) / prevPaid) * 100)}%` : "—" }

        const currCnt = safeOrders.filter(inCurr).length
        const prevCnt = safeOrders.filter(inPrev).length
        const orderCountTrend: TrendData = { direction: currCnt >= prevCnt ? "up" : "down", value: prevCnt > 0 ? `${Math.round(((currCnt - prevCnt) / prevCnt) * 100)}%` : "—" }

        const currAvg = currCnt > 0 ? currVol / currCnt : 0
        const prevAvg = prevCnt > 0 ? prevVol / prevCnt : 0
        const avgOrderValueTrend: TrendData = { direction: currAvg >= prevAvg ? "up" : "down", value: prevAvg > 0 ? `${Math.round(((currAvg - prevAvg) / prevAvg) * 100)}%` : "—" }

        const RANGES: { label: string; min: number; max: number }[] = [
            { label: "Hasta $50k", min: 0, max: 50_000 },
            { label: "$50k - $200k", min: 50_000, max: 200_000 },
            { label: "$200k - $500k", min: 200_000, max: 500_000 },
            { label: "$500k - $1M", min: 500_000, max: 1_000_000 },
            { label: "$1M - $5M", min: 1_000_000, max: 5_000_000 },
            { label: "Más de $5M", min: 5_000_000, max: Infinity },
        ]
        const rangeCounts = RANGES.map((r) => ({
            id: r.label,
            value: filtered.filter((o) => {
                const t = Number(o.total || 0)
                return t >= r.min && t < r.max
            }).length,
        }))
        const priceRangeDistribution = assignChartColors(rangeCounts.filter((r) => r.value > 0))

        return {
            totalVolume,
            totalPaid,
            totalPending,
            orderCount,
            avgOrderValue,
            customerCount,
            deliveredCount,
            pendingDeliveryCount,
            posOrderCount,
            systemOrderCount,
            volumeTrend,
            paidTrend,
            orderCountTrend,
            avgOrderValueTrend,
            channelDistribution,
            paymentMethodDistribution,
            deliveryStatusDistribution,
            monthlyVolume,
            monthlyCount,
            monthlyNet,
            topCustomers,
            customerDistribution,
            topProducts,
            productTypeBreakdown,
            channelTrend,
            monthlyDeliveries,
            priceRangeDistribution,
        }
    }, [orders, dateRange, granularity])
}
