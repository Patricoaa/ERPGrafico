import { useMemo } from "react"
import type { PurchaseOrderAPI } from "../types"
import { parseDateOnly } from "@/lib/utils"
import { assignChartColors } from "@/lib/chart-colors"
import { groupBy, granularityKey, granularitySortValue, today } from "@/lib/analytics-helpers"
import type { Granularity } from "@/lib/analytics-helpers"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    DEBIT_CARD: "Tarjeta Débito",
    CREDIT_CARD: "Tarjeta Crédito",
    CARD_TERMINAL: "Tarjeta (Terminal de cobro)",
    TRANSFER: "Transferencia",
    CHECK: "Cheque",
    CREDIT: "Crédito",
    WRITE_OFF: "Castigo",
    CREDIT_BALANCE: "Saldo a Favor",
    OTHER: "Otro",
}

// ── Public interface ──────────────────────────────────────

export interface TrendData {
    direction: "up" | "down"
    value: string
}

export interface PurchasingAnalyticsData {
    totalVolume: number
    totalPending: number
    totalPaid: number
    orderCount: number
    avgOrderValue: number
    supplierCount: number
    overdueCount: number
    pendingReceiptCount: number
    onTimeDeliveryRate: number
    onTimeCount: number
    lateCount: number
    volumeTrend: TrendData
    paidTrend: TrendData
    pendingTrend: TrendData
    orderCountTrend: TrendData
    avgOrderValueTrend: TrendData
    statusDistribution: Array<{ id: string; value: number; color: string }>
    receivingDistribution: Array<{ id: string; value: number; color: string }>
    topSuppliers: Array<{ supplier: string; total: number; orderCount: number }>
    supplierDistribution: Array<{ id: string; value: number }>
    monthlyVolume: Array<{ month: string; total: number }>
    monthlyCount: Array<{ month: string; count: number }>
    monthlyAvg: Array<{ month: string; avg: number }>
    ordersByWarehouse: Array<{ warehouse: string; count: number }>
    amountRanges: Array<{ range: string; count: number }>
    statusSummary: Array<{ label: string; value: number; total: number }>
    paymentMethodDistribution: Array<{ id: string; value: number; color: string }>
    upcomingReceipts: Array<{
        date: string
        label: string
        description?: string
        status: "success" | "warning" | "destructive" | "neutral"
    }>
    topProductsByVolume: Array<{ product: string; total: number }>
    categoryDistribution: Array<{ id: string; value: number; color: string }>
    dteDistribution: Array<{ id: string; value: number; color: string }>
    invoicedVolumeData: Array<{ id: string; value: number; color: string }>
    invoicedStatusSummary: { invoicedCount: number; pendingCount: number; invoicedVolume: number; pendingVolume: number }
    // Per product-type breakdowns
    storableData: ProductTypeAnalytics
    serviceData: ProductTypeAnalytics
    subscriptionData: ProductTypeAnalytics
    totalLineVolume: number
}

export interface ProductTypeAnalytics {
    topProducts: Array<{ product: string; total: number; count: number }>
    monthlyTrend: Array<{ month: string; total: number }>
    subTypeBreakdown: Array<{ id: string; value: number; color: string }>
    categoryDistribution: Array<{ id: string; value: number; color: string }>
    totalVolume: number
    orderCount: number
}

export function usePurchasingAnalyticsData(
    orders: PurchaseOrderAPI[],
    dateRange?: { from: string; to: string } | null,
    granularity?: Granularity,
): PurchasingAnalyticsData {
    return useMemo(() => {
        // ── Filter by date range ───────────────────────────
        const safeOrders = Array.isArray(orders) ? orders : []
        let filtered = safeOrders
        if (dateRange) {
            filtered = filtered.filter((o) => {
                if (!o.date) return false
                return o.date >= dateRange.from && o.date <= dateRange.to
            })
        }

        const g = granularity ?? "month"
        const keyFn = (o: PurchaseOrderAPI) => granularityKey(o.date || "", g)

        // ── Scalars ────────────────────────────────────────
        const orderCount = filtered.length
        const totalVolume = filtered.reduce((s, o) => s + Number(o.total || 0), 0)
        const totalPaid = filtered.reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const totalPending = filtered.reduce((s, o) => s + Number(o.pending_amount || 0), 0)
        const avgOrderValue = orderCount > 0 ? totalVolume / orderCount : 0
        const supplierNames = new Set(filtered.map((o) => o.supplier_name).filter(Boolean))
        const supplierCount = supplierNames.size

        const todayStr = today()
        const overdueCount = filtered.filter((o) =>
            o.receiving_status !== "RECEIVED"
            && o.receipt_date
            && o.receipt_date < todayStr
        ).length
        const pendingReceiptCount = filtered.filter((o) => o.receiving_status !== "RECEIVED").length

        const receivedWithDates = filtered.filter((o) =>
            o.receiving_status === "RECEIVED"
            && o.receipt_date
            && o.actual_receipt_date
        )
        const onTimeCount = receivedWithDates.filter((o) => (o.actual_receipt_date as string) <= (o.receipt_date as string)).length
        const lateCount = receivedWithDates.length - onTimeCount
        const onTimeDeliveryRate = receivedWithDates.length > 0 ? Math.round((onTimeCount / receivedWithDates.length) * 100) : 0

        // ── Status distribution ────────────────────────────
        const statusGroups = groupBy(filtered, (o) => o.status || "UNKNOWN")
        const statusDistribution = assignChartColors(
            Object.entries(statusGroups)
                .map(([id, items]) => ({ id, value: items.length }))
                .sort((a, b) => b.value - a.value)
        )

        // ── Receiving status distribution ──────────────────
        const receivingGroups = groupBy(safeOrders, (o) => o.receiving_status || "PENDING")
        const receivingDistribution = assignChartColors(
            Object.entries(receivingGroups)
                .map(([id, items]) => ({ id, value: items.length }))
                .sort((a, b) => b.value - a.value)
        )

        // ── Payment method distribution ────────────────────
        function resolvePaymentMethod(o: PurchaseOrderAPI): string {
            const refMethodType = o.payment_method_ref_method_type
            if (refMethodType && refMethodType in PAYMENT_METHOD_LABELS) {
                return refMethodType
            }
            const payments = o.serialized_payments
            if (payments && payments.length > 0) {
                const methodType = payments[0].payment_method_new_method_type
                if (methodType && methodType in PAYMENT_METHOD_LABELS) {
                    return methodType
                }
                const legacy = payments[0].payment_method
                if (legacy && legacy in PAYMENT_METHOD_LABELS && legacy !== "CREDIT") {
                    return legacy
                }
            }
            return "CREDIT"
        }
        const paymentMethodGroups = groupBy(filtered, resolvePaymentMethod)
        const paymentMethodDistribution = assignChartColors(
            Object.entries(paymentMethodGroups)
                .map(([id, items]) => ({
                    id: PAYMENT_METHOD_LABELS[id] ?? id,
                    value: items.length,
                }))
                .sort((a, b) => b.value - a.value)
        )

        // ── Top suppliers ──────────────────────────────────
        const supplierGroups = groupBy(filtered, (o) => o.supplier_name || "Desconocido")
        const supplierAggs = Object.entries(supplierGroups)
            .map(([supplier, items]) => ({
                supplier,
                total: items.reduce((s, o) => s + Number(o.total || 0), 0),
                orderCount: items.length,
            }))
            .sort((a, b) => b.total - a.total)

        const topSuppliers = supplierAggs.slice(0, 8)
        const supplierDistribution = supplierAggs.map((s) => ({
            id: s.supplier,
            value: s.total,
        }))

        // ── Periodic aggregation (granularity-aware) ───────
        const periodGroups = groupBy(filtered, keyFn)
        const monthlyVolume = Object.entries(periodGroups)
            .map(([period, items]) => ({
                month: period,
                total: items.reduce((s, o) => s + Number(o.total || 0), 0),
            }))
            .sort((a, b) => granularitySortValue(a.month, g) - granularitySortValue(b.month, g))

        const monthlyCount = Object.entries(periodGroups)
            .map(([period, items]) => ({
                month: period,
                count: items.length,
            }))
            .sort((a, b) => granularitySortValue(a.month, g) - granularitySortValue(b.month, g))

        const monthlyAvg = Object.entries(periodGroups)
            .map(([period, items]) => ({
                month: period,
                avg: items.reduce((s, o) => s + Number(o.total || 0), 0) / items.length,
            }))
            .sort((a, b) => granularitySortValue(a.month, g) - granularitySortValue(b.month, g))

        // ── Orders by warehouse ────────────────────────────
        const warehouseGroups = groupBy(filtered, (o) => o.warehouse_name || "Sin almacén")
        const ordersByWarehouse = Object.entries(warehouseGroups)
            .map(([warehouse, items]) => ({
                warehouse,
                count: items.length,
            }))
            .sort((a, b) => b.count - a.count)

        // ── Amount ranges ──────────────────────────────────
        const ranges = [
            { label: "< $100.000", min: 0, max: 100_000 },
            { label: "$100k - $500k", min: 100_000, max: 500_000 },
            { label: "$500k - $1M", min: 500_000, max: 1_000_000 },
            { label: "$1M - $5M", min: 1_000_000, max: 5_000_000 },
            { label: "> $5M", min: 5_000_000, max: Infinity },
        ]
        const amountRanges = ranges.map((r) => ({
            range: r.label,
            count: filtered.filter((o) => {
                const t = Number(o.total || 0)
                return t >= r.min && t < r.max
            }).length,
        }))

        // ── Status summary table ───────────────────────────
        const statusSummary = statusDistribution.map((s) => ({
            label: s.id,
            value: s.value,
            total: statusGroups[s.id]?.reduce((sum, o) => sum + Number(o.total || 0), 0) ?? 0,
        }))

        // ── Upcoming receipts timeline ─────────────────────
        const now = today()
        const upcomingReceipts = filtered
            .filter((o) => o.receipt_date && o.receiving_status !== "RECEIVED")
            .sort((a, b) => (a.receipt_date || "").localeCompare(b.receipt_date || ""))
            .slice(0, 15)
            .map((o) => {
                const isOverdue = (o.receipt_date as string) < now
                return {
                    date: o.receipt_date as string,
                    label: o.supplier_name || "Proveedor",
                    description: `${o.display_id || o.number} - ${Number(o.total).toLocaleString("es-CL")}`,
                    status: isOverdue ? ("destructive" as const) : ("warning" as const),
                }
            })

        // ── Period-over-period trends (uses full `orders`, not `filtered`) ──
        function inPeriod(o: PurchaseOrderAPI, periodVal: number, g: "day" | "month" | "year"): boolean {
            if (!o.date) return false
            const d = parseDateOnly(o.date)
            if (g === "year") return d.getFullYear() === periodVal
            if (g === "day") return Math.floor(d.getTime() / 86_400_000) === periodVal
            return d.getMonth() + d.getFullYear() * 12 === periodVal
        }

        const _now = new Date()
        const currPeriod = g === "year" ? _now.getFullYear() : g === "day" ? Math.floor(_now.getTime() / 86_400_000) : _now.getMonth() + _now.getFullYear() * 12
        const prevPeriod = currPeriod - 1
        const inCurr = (o: PurchaseOrderAPI) => inPeriod(o, currPeriod, g)
        const inPrev = (o: PurchaseOrderAPI) => inPeriod(o, prevPeriod, g)

        const currVol = safeOrders.filter(inCurr).reduce((s, o) => s + Number(o.total || 0), 0)
        const prevVol = safeOrders.filter(inPrev).reduce((s, o) => s + Number(o.total || 0), 0)
        const volumeTrend: TrendData = { direction: currVol >= prevVol ? "up" : "down", value: prevVol > 0 ? `${Math.round(((currVol - prevVol) / prevVol) * 100)}%` : "—" }

        const currPaid = safeOrders.filter(inCurr).reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const prevPaid = safeOrders.filter(inPrev).reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const paidTrend: TrendData = { direction: currPaid >= prevPaid ? "up" : "down", value: prevPaid > 0 ? `${Math.round(((currPaid - prevPaid) / prevPaid) * 100)}%` : "—" }

        const currPend = safeOrders.filter(inCurr).reduce((s, o) => s + Number(o.pending_amount || 0), 0)
        const prevPend = safeOrders.filter(inPrev).reduce((s, o) => s + Number(o.pending_amount || 0), 0)
        const pendingTrend: TrendData = { direction: currPend >= prevPend ? "up" : "down", value: prevPend > 0 ? `${Math.round(((currPend - prevPend) / prevPend) * 100)}%` : "—" }

        const currCnt = safeOrders.filter(inCurr).length
        const prevCnt = safeOrders.filter(inPrev).length
        const orderCountTrend: TrendData = { direction: currCnt >= prevCnt ? "up" : "down", value: prevCnt > 0 ? `${Math.round(((currCnt - prevCnt) / prevCnt) * 100)}%` : "—" }

        const currAvg = currCnt > 0 ? currVol / currCnt : 0
        const prevAvg = prevCnt > 0 ? prevVol / prevCnt : 0
        const avgOrderValueTrend: TrendData = { direction: currAvg >= prevAvg ? "up" : "down", value: prevAvg > 0 ? `${Math.round(((currAvg - prevAvg) / prevAvg) * 100)}%` : "—" }

        // ── Helpers: agrega líneas filtradas por tipo ─────
        function buildProductTypeAnalytics(
            types: string[],
            subTypeLabels?: Record<string, string>
        ): ProductTypeAnalytics {
            const typeOrders = filtered.filter(o =>
                Array.isArray(o.lines) && o.lines.some(l => types.includes(l.product_type || ""))
            )

            const productAgg: Record<string, { total: number; count: number }> = {}
            const periodAgg: Record<string, number> = {}
            const subTypeAgg: Record<string, number> = {}
            const categoryAgg: Record<string, number> = {}
            let totalVol = 0

            filtered.forEach(order => {
                const period = keyFn(order)
                if (!Array.isArray(order.lines)) return
                order.lines.forEach(line => {
                    if (!types.includes(line.product_type || "")) return
                    const lineTotal = Number(line.subtotal || (Number(line.quantity || 0) * Number(line.unit_cost || 0)))
                    totalVol += lineTotal
                    // product
                    const name = line.product_name || "Sin nombre"
                    if (!productAgg[name]) productAgg[name] = { total: 0, count: 0 }
                    productAgg[name].total += lineTotal
                    productAgg[name].count += Number(line.quantity || 0)
                    // period
                    periodAgg[period] = (periodAgg[period] || 0) + lineTotal
                    // sub-type
                    const sub = line.product_type || "Otro"
                    subTypeAgg[sub] = (subTypeAgg[sub] || 0) + lineTotal
                    // category
                    const cat = line.category_name || "Sin Categoría"
                    categoryAgg[cat] = (categoryAgg[cat] || 0) + lineTotal
                })
            })

            const topProducts = Object.entries(productAgg)
                .map(([product, s]) => ({ product, total: s.total, count: s.count }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 6)

            const monthlyTrend = monthlyVolume
                .map(m => ({ month: m.month, total: periodAgg[m.month] ?? 0 }))
                .filter(m => m.total > 0)

            const subTypeBreakdown = assignChartColors(
                Object.entries(subTypeAgg)
                    .map(([id, value]) => ({ id: subTypeLabels?.[id] ?? id, value }))
                    .sort((a, b) => b.value - a.value)
            )

            const categoryDistribution = assignChartColors(
                Object.entries(categoryAgg)
                    .map(([id, value]) => ({ id, value }))
                    .sort((a, b) => b.value - a.value)
            )

            return { topProducts, monthlyTrend, subTypeBreakdown, categoryDistribution, totalVolume: totalVol, orderCount: typeOrders.length }
        }

        // ── Datos por tipo de producto ─────────────────────
        const STORABLE_TYPES = ["STORABLE", "CONSUMABLE", "MANUFACTURABLE"]
        const SERVICE_TYPES = ["SERVICE"]
        const SUBSCRIPTION_TYPES = ["SUBSCRIPTION"]
        const STORABLE_LABELS: Record<string, string> = {
            STORABLE: "Almacenable",
            CONSUMABLE: "Consumible",
            MANUFACTURABLE: "Fabricable",
        }

        const storableData = buildProductTypeAnalytics(STORABLE_TYPES, STORABLE_LABELS)
        const serviceData = buildProductTypeAnalytics(SERVICE_TYPES)
        const subscriptionData = buildProductTypeAnalytics(SUBSCRIPTION_TYPES)

        // ── Top productos global (todas las líneas) ────────
        const productStats: Record<string, { total: number }> = {}
        filtered.forEach(order => {
            if (!Array.isArray(order.lines)) return
            order.lines.forEach(line => {
                if (!line.product_name) return
                const lineTotal = Number(line.subtotal || (Number(line.quantity || 0) * Number(line.unit_cost || 0)))
                if (!productStats[line.product_name]) productStats[line.product_name] = { total: 0 }
                productStats[line.product_name].total += lineTotal
            })
        })
        const topProductsByVolume = Object.entries(productStats)
            .map(([product, s]) => ({ product, total: s.total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6)

        // ── Categoría de producto (type-key → etiqueta ES) ─
        const TYPE_LABELS: Record<string, string> = {
            STORABLE: "Almacenable",
            CONSUMABLE: "Consumible",
            MANUFACTURABLE: "Fabricable",
            SERVICE: "Servicio",
            SUBSCRIPTION: "Suscripción",
        }
        const categoryStats: Record<string, number> = {}
        let totalLineVolume = 0
        filtered.forEach(order => {
            if (!Array.isArray(order.lines)) return
            order.lines.forEach(line => {
                const cat = TYPE_LABELS[line.product_type ?? ""] ?? "General"
                const lineTotal = Number(line.subtotal || (Number(line.quantity || 0) * Number(line.unit_cost || 0)))
                categoryStats[cat] = (categoryStats[cat] || 0) + lineTotal
                totalLineVolume += lineTotal
            })
        })
        const categoryDistribution = assignChartColors(
            Object.entries(categoryStats)
                .map(([id, value]) => ({ id, value }))
                .sort((a, b) => b.value - a.value)
        )

        // ── DTE & Facturación ──────────────────────────────
        const dteStats: Record<string, number> = {}
        let invoicedVolume = 0
        let pendingVolume = 0
        let invoicedCount = 0
        let pendingCount = 0

        filtered.forEach(order => {
            const vol = Number(order.total || 0)
            if (order.is_invoiced) {
                invoicedVolume += vol
                invoicedCount += 1
                const dteType = order.invoice_details?.dte_type || "Factura"
                dteStats[dteType] = (dteStats[dteType] || 0) + 1
            } else {
                pendingVolume += vol
                pendingCount += 1
            }
        })

        const dteDistribution = assignChartColors(
            Object.entries(dteStats)
                .map(([id, value]) => ({ id, value }))
                .sort((a, b) => b.value - a.value)
        )

        const invoicedVolumeData = assignChartColors([
            { id: "Facturado", value: invoicedVolume },
            { id: "Sin Facturar", value: pendingVolume }
        ])

        const invoicedStatusSummary = { invoicedCount, pendingCount, invoicedVolume, pendingVolume }

        return {
            totalVolume,
            totalPending,
            totalPaid,
            orderCount,
            avgOrderValue,
            supplierCount,
            overdueCount,
            pendingReceiptCount,
            onTimeDeliveryRate,
            onTimeCount,
            lateCount,
            volumeTrend,
            paidTrend,
            pendingTrend,
            orderCountTrend,
            avgOrderValueTrend,
            statusDistribution,
            receivingDistribution,
            topSuppliers,
            supplierDistribution,
            monthlyVolume,
            monthlyCount,
            monthlyAvg,
            ordersByWarehouse,
            amountRanges,
            statusSummary,
            paymentMethodDistribution,
            upcomingReceipts,
            topProductsByVolume,
            categoryDistribution,
            dteDistribution,
            invoicedVolumeData,
            invoicedStatusSummary,
            storableData,
            serviceData,
            subscriptionData,
            totalLineVolume,
        }
    }, [orders, dateRange, granularity])
}
