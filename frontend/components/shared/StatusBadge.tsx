"use client"

/**
 * StatusBadge — Semantic wrapper for business workflow states.
 *
 * Two presentation modes:
 *   - "default" / "dot" → compact dot + text (DataTable, card lists)
 *   - "badge"            → square tinted badge with dot indicator (Modal, Drawer, detail views)
 *   - "hub"              → circular icon badge (workflow dashboards, preserved)
 *
 * Rule (GOVERNANCE §18): StatusBadge is the ONLY authorized status renderer.
 * Do NOT use <Badge> or <Chip> directly for workflow states.
 *
 * @example
 * <StatusBadge status="PAID" />                                   // dot + text
 * <StatusBadge status="PAID" variant="badge" />                   // square badge + dot
 * <StatusBadge status="IN_PROGRESS" variant="hub" icon={Activity} tooltip="En Proceso" />
 */

import React from 'react'
import { resolveStatus } from '@/lib/badge-resolvers'
import { Badge } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface StatusBadgeProps {
    /** Business status string. Case-insensitive. Resolved via STATUS_MAP. */
    status: string
    /** Override the resolved label */
    label?: string
    /** Visual variant. 'dot'=compact, 'badge'=pill+dot, 'hub'=circular icon. */
    variant?: 'default' | 'dot' | 'badge' | 'hub'
    /** Icon — required for variant="hub", optional for default */
    icon?: LucideIcon
    /** Tooltip — used with variant="hub" */
    tooltip?: string
    /** Size — controls dot size and font size. Default: 'md'. */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Progress percentage (0-100) for hub variant — renders SVG progress ring */
    progress?: number
    /** Layout/position only. Never typography or colors. */
    className?: string
    /** Badge appearance — solid (default) or ghost (transparent background). Only applies to variant="badge". */
    appearance?: 'solid' | 'ghost'
}

const DOT_COLORS: Record<string, string> = {
    neutral:     'bg-muted-foreground',
    info:        'bg-info',
    success:     'bg-success',
    warning:     'bg-warning',
    destructive: 'bg-destructive',
    primary:     'bg-primary',
}

const DOT_SIZES: Record<string, string> = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-3.5 w-3.5',
}

const TEXT_SIZES: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
}

export function StatusBadge({
    status,
    label,
    variant = 'default',
    icon: Icon,
    tooltip,
    size = 'md',
    progress,
    className,
    appearance,
}: StatusBadgeProps) {
    const { intent, label: resolvedLabel } = resolveStatus(status)
    const displayLabel = label ?? resolvedLabel

    if (variant === 'hub' && Icon) {
        return (
            <Badge.Hub
                intent={intent}
                icon={Icon}
                tooltip={tooltip}
                size={size === 'xl' || size === 'lg' ? 'md' : 'sm'}
                progress={progress}
                className={className}
            />
        )
    }

    if (variant === 'badge') {
        // Kept for backward compatibility, behaves the same as default now
        return (
            <Badge intent={intent} size={size} appearance={appearance} className={className} dot={true}>
                {displayLabel}
            </Badge>
        )
    }

    if (variant === 'dot') {
        return (
            <Badge.Dot intent={intent} size={size as any} className={className}>
                {displayLabel}
            </Badge.Dot>
        )
    }

    return (
        <Badge
            intent={intent}
            size={size}
            appearance={appearance}
            className={className}
            dot={true}
            icon={Icon}
        >
            {displayLabel}
        </Badge>
    )
}

// Re-export STATUS_MAP for the rare cases where external consumers need to read it
// (e.g. DataCell.Status, column definitions that need intent without rendering)
export { STATUS_MAP, resolveStatus } from '@/lib/badge-resolvers'
