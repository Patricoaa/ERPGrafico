"use client"

/**
 * EntityBadge — Premium component to display entity identifiers consistently.
 *
 * Thin wrapper over <Badge>. Uses resolveEntity() to map entity label + data
 * to display code, icon, and detail URL. Renders a Link if URL exists.
 *
 * Decision tree:
 *   workflow state → StatusBadge
 *   entity ID/number → EntityBadge
 *   everything else → Chip
 *
 * @example
 * <EntityBadge label="order" data={order} />
 */

import React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/shared'
import { resolveEntity } from '@/lib/badge-resolvers'
import { hasEntityDrawer } from '@/lib/entity-drawers'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { Package } from 'lucide-react'

export interface EntityBadgeProps {
    /** The entity registry key (e.g. "order", "invoice", "payment") */
    label: string
    /** The entity data object (must contain at least 'id' for link generation) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
    /** Whether to show the entity's icon. Default: true */
    showIcon?: boolean
    /** Whether to wrap the badge in a Link to the entity's detail view. Default: true */
    link?: boolean
    /** Size. Default: 'md'. */
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Shape. Pill (rounded-full) or square (rounded-sm). Default: pill */
    rounded?: boolean
    /** Layout/position classes only */
    className?: string
}

export const EntityBadge: React.FC<EntityBadgeProps> = ({
    label,
    data,
    showIcon = true,
    link = true,
    size = 'md',
    rounded = true,
    className,
}) => {
    const { openEntity } = useGlobalModals()

    if (!data) return null

    const { displayCode, icon: ResolvedIcon, href } = resolveEntity(label, data)
    const Icon = showIcon ? (ResolvedIcon ?? Package) : undefined

    const customStyle = "bg-secondary/30 text-secondary-foreground border-secondary/50 hover:bg-secondary/50 hover:border-secondary"

    const badgeEl = (
        <Badge
            intent="neutral"
            size={size}
            tracking="tight"
            shape={rounded ? 'pill' : 'square'}
            icon={Icon}
            className={`${customStyle} max-w-[200px] truncate ${className ?? ''}`}
        >
            {displayCode}
        </Badge>
    )

    if (!link) return badgeEl

    // Prefer in-context drawer when registered. Fallback to navigation.
    const entityId = data?.id
    if (hasEntityDrawer(label) && entityId !== undefined && entityId !== null) {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openEntity(label, Number(entityId), data) }}
                className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-shadow"
            >
                {badgeEl}
            </button>
        )
    }

    if (href) {
        return (
            <Link
                href={href}
                className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-shadow"
            >
                {badgeEl}
            </Link>
        )
    }

    return badgeEl
}

EntityBadge.displayName = 'EntityBadge'
