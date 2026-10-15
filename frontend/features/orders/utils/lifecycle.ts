import { Banknote, ClipboardList, FileText, Package, TrendingUp } from "lucide-react"
import type { LifecycleStep, LifecycleStepStatus } from "@/components/shared"
import { getHubStatuses } from "@/lib/workflow-status"
import type { Order, OrderLine } from "../types"

const toNumber = (value: unknown) => {
    const n = parseFloat(String(value ?? 0))
    return Number.isFinite(n) ? n : 0
}

const pct = (part: number, total: number) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0)

/**
 * Ciclo de una OV/OC para la franja de la ficha (ADR-0083): Origen → Facturación →
 * Manufactura → Logística → Tesorería. Los ids coinciden con las áreas del tab Relaciones.
 * Los estados salen de `getHubStatuses` (lib/workflow-status), la misma fuente que la tarjeta
 * de la lista: tarjeta y ficha no pueden discrepar. Facturación exige facturado completo y folio.
 */
export function getOrderLifecycle(order: Order, kind: "sale" | "purchase"): LifecycleStep[] {
    const hub = getHubStatuses(order as unknown as Parameters<typeof getHubStatuses>[0])
    const lines: OrderLine[] = order.lines ?? order.items ?? []

    const ordered = lines.reduce((sum, l) => sum + toNumber(l.quantity), 0)
    const processed = lines.reduce((sum, l) => sum + toNumber(kind === "sale" ? (l.quantity_delivered ?? l.delivered_quantity) : (l.quantity_received ?? l.received_quantity)), 0)
    const invoicedQty = lines.reduce((sum, l) => sum + toNumber(l.quantity_invoiced), 0)
    const logisticsPct = ordered > 0 ? pct(processed, ordered) : (lines.length > 0 ? 100 : 0)

    // Misma regla que la tarjeta de la lista (lib/workflow-status · billingStage)
    const billing = hub.billing as LifecycleStepStatus
    const billingPct = pct(invoicedQty, ordered)
    const billingDetail = hub.billingFolioPending ? "Folio pendiente" : `${billingPct}% facturado`

    const workOrders = (order.work_orders ?? []).filter((ot) => ot.status !== "CANCELLED")
    const productionPct = workOrders.length > 0
        ? Math.round(workOrders.reduce((sum, ot) => sum + (ot.production_progress ?? 0), 0) / workOrders.length)
        : 0

    const total = toNumber(order.effective_total ?? order.total)
    const pending = toNumber(order.pending_amount)
    const paid = Math.max(0, total - pending)
    const isCancelled = order.status === "CANCELLED"

    return [
        { id: "origin", label: "Origen", icon: TrendingUp, status: hub.origin as LifecycleStepStatus },
        {
            id: "billing", label: "Facturación", icon: FileText, status: isCancelled ? "not_applicable" : billing,
            progress: billingPct, detail: billingDetail,
        },
        {
            id: "production", label: "Manufactura", icon: ClipboardList,
            status: kind === "sale" && !isCancelled ? (hub.production as LifecycleStepStatus) : "not_applicable",
            progress: productionPct, detail: `${workOrders.length} OT · ${productionPct}%`,
        },
        {
            id: "logistics", label: "Logística", icon: Package, status: isCancelled ? "not_applicable" : (hub.logistics as LifecycleStepStatus),
            progress: logisticsPct, detail: `${logisticsPct}% ${kind === "sale" ? "entregado" : "recibido"}`,
        },
        {
            id: "treasury", label: "Tesorería", icon: Banknote, status: isCancelled ? "not_applicable" : (hub.treasury as LifecycleStepStatus),
            progress: pct(paid, total), detail: `${pct(paid, total)}% pagado`,
        },
    ]
}
