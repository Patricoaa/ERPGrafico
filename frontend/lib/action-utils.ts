import type { Action } from '@/types/actions'

/**
 * Calculate dynamic badge count for an action
 */
export function getActionBadgeCount(action: Action<unknown>, order: unknown): number | undefined {
    if (!order) return undefined
    const o = order as { serialized_payments?: { length?: number }; invoices?: { length?: number }; deliveries?: { length?: number }; receipts?: { length?: number } }
    switch (action.id) {
        case 'payment-history':
            return o.serialized_payments?.length
        case 'view-receptions':
            return o.receipts?.length
        case 'view-deliveries':
            return o.deliveries?.length
        case 'view-documents':
            return o.invoices?.length
        default:
            return action.badge?.count
    }
}

