import { getHubStatuses, isOrderCompleted } from "@/lib/workflow-status"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import type { SaleOrder } from "../types"

/**
 * Readable stage summary for table queues (DTL-01).
 * Derives a single leading-stage label from order status + parsed workflow hub statuses —
 * transitions never depend on fabricated literals.
 */
export function orderStageSummary(order: SaleOrder): { status: string; label: string; intent: BadgeIntent } {
    const s = getHubStatuses(order)
    // ADR-0084: el pago es su propio eje (payment_status), no un estado de la OV
    const paid = order.payment_status === 'PAID' || (Number(order.total) === 0 && Number(order.pending_amount) === 0)

    if (order.status === 'CANCELLED' || s.origin === 'destructive') return { status: 'CANCELLED', label: 'Cancelada', intent: 'destructive' }
    if (isOrderCompleted(order)) return { status: 'SUCCESS', label: 'Completada', intent: 'success' }
    if (paid || s.treasury === 'success') return { status: 'PAID', label: 'Cobrada', intent: 'success' }
    if (s.billing === 'success') return { status: 'BILLED', label: 'Facturada', intent: 'info' }
    if (s.production === 'warning' || s.production === 'active') return { status: 'PRODUCTION', label: 'En Producción', intent: 'warning' }
    if (s.origin === 'success') return { status: 'PROCESSING', label: 'En Proceso', intent: 'primary' }
    return { status: 'DRAFT', label: 'Borrador', intent: 'neutral' }
}
