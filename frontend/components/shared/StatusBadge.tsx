"use client"

/**
 * StatusBadge — Semantic wrapper for business workflow states.
 *
 * Thin wrapper over <Badge>. Resolves status string → intent via STATUS_MAP.
 * All visual decisions live in Badge. All business logic lives in resolveStatus().
 *
 * Rule (GOVERNANCE §18): StatusBadge is the ONLY authorized status renderer.
 * Do NOT use <Badge> or <Chip> directly for workflow states.
 *
 * @example
 * <StatusBadge status="PAID" />
 * <StatusBadge status={order.status} label="custom label" variant="dot" />
 * <StatusBadge status="IN_PROGRESS" variant="hub" icon={Activity} tooltip="En Proceso" />
 */

import React from 'react'
import { resolveStatus } from '@/lib/badge-resolvers'
import { Badge } from '@/components/shared'
import type { LucideIcon } from 'lucide-react'

export interface StatusBadgeProps {
    /** Business status string. Case-insensitive. Resolved via STATUS_MAP. */
    status: string
    /** Override the resolved label */
    label?: string
    /** Visual variant. Default: 'default' (pill). */
    variant?: 'default' | 'dot' | 'hub'
    /** Icon — required for variant="hub", optional for default */
    icon?: LucideIcon
    /** Tooltip — used with variant="hub" */
    tooltip?: string
    /** Size — controls height and font size. Default: 'md' (h-6, tables). */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Progress percentage (0-100) for hub variant — renders SVG progress ring */
    progress?: number
    /** Layout/position only. Never typography or colors. */
    className?: string
}

export function StatusBadge({
    status,
    label,
    variant = 'default',
    icon: Icon,
    tooltip,
    size = 'sm',
    progress,
    className,
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

    if (variant === 'dot') {
        return (
            <Badge.Dot intent={intent} size={size} className={className}>
                {displayLabel}
            </Badge.Dot>
        )
    }

    // Default: pill badge (tracking="tight" — longer labels need tight spacing)
    return (
        <Badge
            intent={intent}
            size={size}
            tracking="tight"
            icon={Icon}
            className={className}
        >
            {displayLabel}
        </Badge>
    )
}

// Re-export STATUS_MAP for the rare cases where external consumers need to read it
// (e.g. DataCell.Status, column definitions that need intent without rendering)
export { STATUS_MAP, resolveStatus } from '@/lib/badge-resolvers'
