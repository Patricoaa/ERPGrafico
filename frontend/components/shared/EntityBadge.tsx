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

import { Button } from "@/components/ui/button"
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
    data: object
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
    /**
     * Optional segmenter (filtro/segmentador) rendered at the bottom of the entity drawer.
     * Useful for adding data-segmentation controls (date range, category filter, etc.)
     * to visualization panels inside the drawer. Totally optional per entity.
     */
    segmenter?: React.ReactNode
}

export const EntityBadge: React.FC<EntityBadgeProps> = ({
    label,
    data,
    showIcon = true,
    link = true,
    size = 'md',
    rounded = true,
    className,
    segmenter,
}) => {
    const { openEntity } = useGlobalModals()

    if (!data) return null

    const { displayCode, icon: ResolvedIcon, href } = resolveEntity(label, data as Record<string, unknown>)
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
    const entityId = (data as Record<string, unknown>).id as number | undefined
    if (hasEntityDrawer(label) && entityId !== undefined && entityId !== null) {
        return (
            <Button
                type="button"
                onClick={(e) => { e.stopPropagation(); openEntity(label, Number(entityId), data, segmenter) }}
                className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-shadow"
            >
                {badgeEl}
            </Button>
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
