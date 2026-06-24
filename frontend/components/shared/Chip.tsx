"use client"

import { type LucideIcon } from 'lucide-react'
import type { BadgeIntent } from '@/lib/badge-resolvers'
import { Badge } from '@/components/shared'
import { resolveCategory } from '@/lib/badge-resolvers'

export interface ChipProps {
    children: React.ReactNode
    intent?: BadgeIntent
    size?: 'xs' | 'sm' | 'md'
    icon?: LucideIcon
    className?: string
}

export function Chip({ children, intent = 'neutral', size = 'sm', icon, className }: ChipProps) {
    return (
        <Badge intent={intent} size={size} tracking="wide" icon={icon} className={className}>
            {children}
        </Badge>
    )
}

// ----------------------------------------------------------------------
// INTELLIGENT UTILITIES
// ----------------------------------------------------------------------

/**
 * Chip.Category
 * Automatically maps standard domain enumerations (like product_type, tax_type)
 * to their correct visual intent and standardized label.
 */
Chip.Category = function ChipCategory({
    domain,
    value,
    size = 'sm',
    className
}: {
    domain: 'product_type' | 'tax_type' | 'transaction_type' | 'dte_type' | 'contact_type'
    value: string
    size?: 'xs' | 'sm' | 'md'
    className?: string
}) {
    const { intent, label } = resolveCategory(domain, value)
    return (
        <Chip intent={intent} size={size} className={className}>
            {label}
        </Chip>
    )
}

/**
 * Chip.Flag
 * Automatically maps true/false values to semantic intents (success/muted/destructive).
 */
Chip.Flag = function ChipFlag({
    isTrue,
    trueLabel,
    falseLabel,
    trueIntent = 'success',
    falseIntent = 'neutral',
    size = 'sm',
    className
}: {
    isTrue: boolean
    trueLabel: string
    falseLabel?: string
    trueIntent?: BadgeIntent
    falseIntent?: BadgeIntent
    size?: 'xs' | 'sm' | 'md'
    className?: string
}) {
    if (!isTrue && !falseLabel) return null // Hide if false and no label provided
    
    return (
        <Chip 
            intent={isTrue ? trueIntent : falseIntent} 
            size={size} 
            className={className}
        >
            {isTrue ? trueLabel : falseLabel}
        </Chip>
    )
}

/**
 * Chip.Count
 * Specialized chip for displaying counts. Hides by default if 0.
 * Automatically uses 'primary' intent if value > 0, unless overridden.
 */
Chip.Count = function ChipCount({
    value,
    label,
    hideOnZero = true,
    intent = 'primary',
    zeroIntent = 'neutral',
    size = 'xs',
    className
}: {
    value: number
    label?: string
    hideOnZero?: boolean
    intent?: BadgeIntent
    zeroIntent?: BadgeIntent
    size?: 'xs' | 'sm' | 'md'
    className?: string
}) {
    if (value === 0 && hideOnZero) return null

    const displayValue = label ? `${label} (${value})` : value.toString()
    
    return (
        <Chip 
            intent={value > 0 ? intent : zeroIntent} 
            size={size} 
            className={className}
        >
            {displayValue}
        </Chip>
    )
}
