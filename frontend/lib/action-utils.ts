import type { ActionRegistry, Action, UserPermissions } from '@/types/actions'

/**
 * Filter actions based on order state and user permissions
 */
export function filterAvailableActions<T extends { status: string }>(
    registry: ActionRegistry<T>,
    order: T,
    userPermissions?: UserPermissions
): ActionRegistry<T> {
    const filtered: ActionRegistry<T> = {}

    for (const [categoryKey, category] of Object.entries(registry)) {
        const availableActions = category.actions.filter(action => {
            // Check status requirements
            if (action.requiredStatus && !action.requiredStatus.includes(order.status)) {
                return false
            }

            if (action.excludedStatus && action.excludedStatus.includes(order.status)) {
                return false
            }

            // Check custom availability
            if (action.checkAvailability && !action.checkAvailability(order)) {
                return false
            }

            // Check Django permissions
            if (action.requiredPermissions && userPermissions) {
                // Superusers bypass permission checks
                if (userPermissions.isSuperuser) {
                    return true
                }

                // Check if user has all required permissions
                return action.requiredPermissions.every(perm =>
                    userPermissions.permissions.includes(perm)
                )
            }

            return true
        })

        if (availableActions.length > 0) {
            filtered[categoryKey] = {
                ...category,
                actions: availableActions
            }
        }
    }

    return filtered
}

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

