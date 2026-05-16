import type { ActionRegistry, Action, UserPermissions } from '@/types/actions'

/**
 * Filter actions based on order state and user permissions
 */
export function filterAvailableActions(
    registry: ActionRegistry,
    order: any,
    userPermissions?: UserPermissions
): ActionRegistry {
    const filtered: ActionRegistry = {}

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
export function getActionBadgeCount(action: Action, order: any): number | undefined {
    if (!order) return undefined
    switch (action.id) {
        case 'payment-history':
            return order.related_documents?.payments?.length || order.serialized_payments?.length
        case 'view-receptions':
            return order.related_documents?.receipts?.length
        case 'view-deliveries':
            return order.related_documents?.deliveries?.length
        case 'view-documents':
            return order.related_documents?.invoices?.length || order.invoices?.length
        default:
            return action.badge?.count
    }
}

