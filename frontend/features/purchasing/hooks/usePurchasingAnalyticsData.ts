import { useMemo } from "react"
import type { PurchaseOrderAPI } from "../types"

// ── Color palettes for charts ─────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "#6b7280",
    CONFIRMED: "#3b82f6",
    RECEIVED: "#06b6d4",
    INVOICED: "#f59e0b",
    PAID: "#22c55e",
    CANCELLED: "#ef4444",
}

const RECEIVING_COLORS: Record<string, string> = {
    PENDING: "#f59e0b",
    PARTIAL: "#3b82f6",
    RECEIVED: "#22c55e",
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
    CASH: "#22c55e",
    CARD: "#3b82f6",
    TRANSFER: "#8b5cf6",
    CHECK: "#f59e0b",
    CREDIT: "#ef4444",
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    CHECK: "Cheque",
    CREDIT: "Crédito",
}

const CATEGORICAL = [
    "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
    "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
]

// ── Helpers ───────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const map: Record<string, T[]> = {}
    for (const item of items) {
        const key = keyFn(item)
        if (!map[key]) map[key] = []
        map[key].push(item)
    }
    return map
}

function formatMonth(dateStr: string): string {
    const d = new Date(dateStr)
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatYear(dateStr: string): string {
    return new Date(dateStr).getFullYear().toString()
}

function formatDay(dateStr: string): string {
    const d = new Date(dateStr)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}/${mm}`
}

function granularityKey(dateStr: string, g: "day" | "month" | "year"): string {
    if (g === "day") return formatDay(dateStr)
    if (g === "year") return formatYear(dateStr)
    return formatMonth(dateStr)
}

function granularitySortValue(key: string, g: "day" | "month" | "year"): number {
    if (g === "day") {
        const [dd, mm, yyyy] = key.split("/").map(Number)
        return new Date(yyyy, mm - 1, dd).getTime()
    }
    if (g === "year") return Number(key)
    // month: "Ene 2024" → parse month + year
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    const [m, y] = key.split(" ")
    return new Date(Number(y), months.indexOf(m), 1).getTime()
}

function today(): string {
    return new Date().toISOString().split("T")[0]
}

// ── Public interface ──────────────────────────────────────

export interface TrendData {
    direction: "up" | "down"
    value: string
}

export interface PurchasingHubData {
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
}

export function usePurchasingHubData(
    orders: PurchaseOrderAPI[],
    dateRange?: { from: string; to: string } | null,
    granularity?: "day" | "month" | "year",
): PurchasingHubData {
    return useMemo(() => {
        // ── Filter by date range ───────────────────────────
        let filtered = orders
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
        const onTimeCount = receivedWithDates.filter((o) => o.actual_receipt_date! <= o.receipt_date!).length
        const lateCount = receivedWithDates.length - onTimeCount
        const onTimeDeliveryRate = receivedWithDates.length > 0 ? Math.round((onTimeCount / receivedWithDates.length) * 100) : 0

        // ── Status distribution ────────────────────────────
        const statusGroups = groupBy(filtered, (o) => o.status || "UNKNOWN")
        const statusDistribution = Object.entries(statusGroups)
            .map(([id, items]) => ({
                id,
                value: items.length,
                color: STATUS_COLORS[id] ?? "#6b7280",
            }))
            .sort((a, b) => b.value - a.value)

        // ── Receiving status distribution ──────────────────
        const receivingGroups = groupBy(orders, (o) => o.receiving_status || "PENDING")
        const receivingDistribution = Object.entries(receivingGroups)
            .map(([id, items]) => ({
                id,
                value: items.length,
                color: RECEIVING_COLORS[id] ?? "#6b7280",
            }))
            .sort((a, b) => b.value - a.value)

        // ── Payment method distribution ────────────────────
        const paymentMethodGroups = groupBy(filtered, (o) => (o as any).payment_method || "CREDIT")
        const paymentMethodDistribution = Object.entries(paymentMethodGroups)
            .map(([id, items]) => ({
                id: PAYMENT_METHOD_LABELS[id] ?? id,
                value: items.length,
                color: PAYMENT_METHOD_COLORS[id] ?? "#6b7280",
            }))
            .sort((a, b) => b.value - a.value)

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
                const isOverdue = o.receipt_date! < now
                return {
                    date: o.receipt_date!,
                    label: o.supplier_name || "Proveedor",
                    description: `${o.display_id || o.number} - ${Number(o.total).toLocaleString("es-CL")}`,
                    status: isOverdue ? ("destructive" as const) : ("warning" as const),
                }
            })

        // ── Period-over-period trends (uses full `orders`, not `filtered`) ──
        function inPeriod(o: PurchaseOrderAPI, periodVal: number, g: "day" | "month" | "year"): boolean {
            const d = new Date(o.date || "")
            if (isNaN(d.getTime())) return false
            if (g === "year") return d.getFullYear() === periodVal
            if (g === "day") return Math.floor(d.getTime() / 86_400_000) === periodVal
            return d.getMonth() + d.getFullYear() * 12 === periodVal
        }

        const _now = new Date()
        const currPeriod = g === "year" ? _now.getFullYear() : g === "day" ? Math.floor(_now.getTime() / 86_400_000) : _now.getMonth() + _now.getFullYear() * 12
        const prevPeriod = currPeriod - 1
        const inCurr = (o: PurchaseOrderAPI) => inPeriod(o, currPeriod, g)
        const inPrev = (o: PurchaseOrderAPI) => inPeriod(o, prevPeriod, g)

        const currVol = orders.filter(inCurr).reduce((s, o) => s + Number(o.total || 0), 0)
        const prevVol = orders.filter(inPrev).reduce((s, o) => s + Number(o.total || 0), 0)
        const volumeTrend: TrendData = { direction: currVol >= prevVol ? "up" : "down", value: prevVol > 0 ? `${Math.round(((currVol - prevVol) / prevVol) * 100)}%` : "—" }

        const currPaid = orders.filter(inCurr).reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const prevPaid = orders.filter(inPrev).reduce((s, o) => s + Number(o.total_paid || 0), 0)
        const paidTrend: TrendData = { direction: currPaid >= prevPaid ? "up" : "down", value: prevPaid > 0 ? `${Math.round(((currPaid - prevPaid) / prevPaid) * 100)}%` : "—" }

        const currPend = orders.filter(inCurr).reduce((s, o) => s + Number(o.pending_amount || 0), 0)
        const prevPend = orders.filter(inPrev).reduce((s, o) => s + Number(o.pending_amount || 0), 0)
        const pendingTrend: TrendData = { direction: currPend >= prevPend ? "up" : "down", value: prevPend > 0 ? `${Math.round(((currPend - prevPend) / prevPend) * 100)}%` : "—" }

        const currCnt = orders.filter(inCurr).length
        const prevCnt = orders.filter(inPrev).length
        const orderCountTrend: TrendData = { direction: currCnt >= prevCnt ? "up" : "down", value: prevCnt > 0 ? `${Math.round(((currCnt - prevCnt) / prevCnt) * 100)}%` : "—" }

        const currAvg = currCnt > 0 ? currVol / currCnt : 0
        const prevAvg = prevCnt > 0 ? prevVol / prevCnt : 0
        const avgOrderValueTrend: TrendData = { direction: currAvg >= prevAvg ? "up" : "down", value: prevAvg > 0 ? `${Math.round(((currAvg - prevAvg) / prevAvg) * 100)}%` : "—" }

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
        }
    }, [orders, dateRange, granularity])
}
