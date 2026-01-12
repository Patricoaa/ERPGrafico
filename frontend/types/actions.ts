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
export interface Action {
    id: string
    label: string
    icon: LucideIcon

    // Permission checks
    requiredPermissions?: string[]

    // Status-based availability
    requiredStatus?: string[]
    excludedStatus?: string[]

    // Custom availability check
    checkAvailability?: (order: any) => boolean

    // Action handler
    onClick?: (order: any) => void

    // Visual indicators
    badge?: ActionBadge
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
}

/**
 * Category of related actions
 */
export interface ActionCategory {
    id: string
    label: string
    icon: LucideIcon
    actions: Action[]
}

/**
 * Complete action registry for an order type
 */
export type ActionRegistry = Record<string, ActionCategory>

/**
 * User permissions structure
 */
export interface UserPermissions {
    permissions: string[]
    isSuperuser?: boolean
}
