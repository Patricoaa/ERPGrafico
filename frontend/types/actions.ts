import { LucideIcon } from 'lucide-react'

/**
 * Badge configuration for action buttons
 */
export interface ActionBadge {
    type: 'pending' | 'completed' | 'warning' | 'info'
    count?: number
    label?: string
}

/**
 * Individual action definition
 */
export interface Action<T = unknown> {
    id: string
    label: string
    icon: LucideIcon

    // Permission checks
    requiredPermissions?: string[]

    // Status-based availability
    requiredStatus?: string[]
    excludedStatus?: string[]

    // Custom availability check
    checkAvailability?: (order: T) => boolean

    // Action handler
    onClick?: (order: T) => void

    // Visual indicators
    badge?: ActionBadge
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
    description?: string
    isDisabled?: (order: T) => boolean
    disabledTooltip?: string | ((order: T) => string)
}

/**
 * Category of related actions
 */
export interface ActionCategory<T = unknown> {
    id: string
    label: string
    icon: LucideIcon
    actions: Action<T>[]
}

/**
 * Complete action registry for an order type
 */
export type ActionRegistry<T = unknown> = Record<string, ActionCategory<T>>

/**
 * User permissions structure
 */
export interface UserPermissions {
    permissions: string[]
    isSuperuser?: boolean
}
