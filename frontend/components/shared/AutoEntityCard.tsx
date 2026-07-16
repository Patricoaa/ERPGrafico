"use client"

import React from "react"
import { EntityCard } from "@/components/shared/EntityCard"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { renderEntitySubtitleItems, type SubtitleItem } from "@/lib/entity-registry"

export interface AutoEntityCardProps<TData> {
    /** The raw entity data */
    data: TData
    /** The fields factory returned by createEntityFields() */
    fields: {
        toCardFields: (data: TData, opts?: { only?: string[] }) => Array<{
            key: string
            label: string
            value: React.ReactNode
            cardPlacement?: 'auto' | 'header-right' | 'center' | 'body'
            cardSize?: 'xs' | 'sm' | 'md' | 'lg'
            cardClassName?: string
        }>
    }
    /** Entity label for registry lookups (e.g. 'sales.order') — used for auto-subtitle and hub status */
    entityLabel?: string
    /** Optional icon to render in the header */
    icon?: LucideIcon
    /** Optional class name for the icon */
    iconClassName?: string
    /** Optional actions to render in the header (usually from your actions factory) */
    actions?: React.ReactNode
    /** Optional default action to trigger when the card is clicked (used by keyboard/accessibility) */
    defaultAction?: ((e: React.MouseEvent) => void) | null
    /** Optional onClick handler for the entire card (takes precedence over defaultAction for the click target) */
    onClick?: () => void
    /** Whether the card is visually selected */
    isSelected?: boolean
    /** Additional CSS classes for the card container */
    className?: string
    /** Optional image URL to render in the header (takes precedence over icon) — used by hero variant */
    imageSrc?: string
    /** Optional trailing slot to render in the header (e.g. badges, status) */
    trailing?: React.ReactNode
    /** Optional explicit title (overrides automatic selection from fields) */
    title?: React.ReactNode
    /** Optional explicit subtitle */
    subtitle?: React.ReactNode
    /** Optional center slot to render in the header */
    center?: React.ReactNode
    /** Optional children to render custom blocks like Metrics or Footer inside the card */
    children?: React.ReactNode
    /**
     * Unified card variant — controls layout zones, field placement, and root styling.
     * - 'highlights': dashboard/summary — header only (icon + title + subtitle + trailing + actions)
     * - 'minimal': management, dense — header + body fields WITHOUT labels
     * - 'compact': management, inline fields — header only with fields inline (header-right)
     * - 'full': management, complete — header + body + metrics + footer + workflow
     * - 'hero': products, visual — Hero header (image 64×64) + body
     * - 'flow': transfers, directional — header with center (source → dest arrow)
     */
    variant?: 'highlights' | 'minimal' | 'compact' | 'full' | 'hero' | 'flow'
    /**
     * Hub status renderer — called for compact/full variants to render domain-specific
     * status content in the header center area.
     */
    hubStatusRenderer?: (data: TData) => React.ReactNode
    /**
     * Workflow renderer — called for full variant to render workflow body content
     * (line items, totals, pending, delivery date).
     */
    workflowRenderer?: (data: TData) => React.ReactNode
}

/**
 * Classifies card fields into layout zones based on variant.
 * Returns { headerRight, center, body } buckets.
 */
function classifyFieldsByVariant<TData>(
    fields: ReturnType<AutoEntityCardProps<TData>['fields']['toCardFields']>,
    variant: AutoEntityCardProps<TData>['variant']
): { headerRight: typeof fields; center: typeof fields; body: typeof fields } {
    const explicitHeaderRight = fields.filter(f => f.cardPlacement === 'header-right')
    const explicitBody = fields.filter(f => f.cardPlacement === 'body')
    const explicitCenter = fields.filter(f => f.cardPlacement === 'center')
    const autoFields = fields.filter(f => !f.cardPlacement || f.cardPlacement === 'auto')

    let headerRight = [...explicitHeaderRight]
    let body = [...explicitBody]
    const center = [...explicitCenter]

    switch (variant) {
        case 'highlights':
            // Dashboard/summary — only header fields, no body
            headerRight = [...headerRight, ...autoFields]
            break

        case 'minimal':
            // Dense management — all fields to body, no labels
            body = [...body, ...autoFields]
            break

        case 'compact':
            // Inline fields — force all to header-right (no labels)
            headerRight = [...headerRight, ...autoFields]
            break

        case 'full':
        case 'hero':
        case 'flow':
        default:
            // Default heuristic: <= 2 auto → header-right, else body
            if (autoFields.length <= 2) {
                headerRight = [...headerRight, ...autoFields]
            } else {
                body = [...body, ...autoFields]
            }
            break
    }

    return { headerRight, center, body }
}

/**
 * Builds structured SubtitleItem[] for the card.
 * Falls back to explicit subtitle/title → text items if no registry data available.
 */
function buildSubtitleItems<TData>(
    entityLabel: string | undefined,
    data: TData,
    explicitSubtitle: React.ReactNode | undefined,
    explicitTitle: React.ReactNode | undefined,
    firstField: { value: React.ReactNode } | undefined
): SubtitleItem[] {
    if (explicitSubtitle !== undefined) {
        return [{ kind: 'text', content: String(explicitSubtitle) }]
    }
    if (entityLabel && typeof data === 'object' && data !== null) {
        const items = renderEntitySubtitleItems(entityLabel, data as Record<string, unknown>)
        if (items.length > 0) return items
    }
    if (explicitTitle === undefined && firstField) {
        const val = firstField.value
        if (val !== undefined && val !== null) {
            return [{ kind: 'text', content: String(val) }]
        }
    }
    return []
}

/**
 * AutoEntityCard - A standardized card component for Master Data entities.
 * 
 * Automatically generates the EntityCard layout using the fields defined in `createEntityFields`.
 * - Uses `cardPlacement` metadata ('header-right', 'center', 'body') to position fields.
 * - Uses `variant` to control layout zones and field placement.
 * - Supports `hubStatusRenderer` for compact/full variants.
 * - Supports `workflowRenderer` for full variant.
 * - Auto-generates subtitle from registry when no explicit subtitle is provided.
 */
export function AutoEntityCard<TData>({ 
    data, 
    fields, 
    entityLabel,
    title,
    subtitle,
    center,
    icon, 
    iconClassName,
    actions, 
    defaultAction, 
    onClick,
    isSelected,
    className,
    imageSrc, 
    trailing,
    children,
    variant = 'full',
    hubStatusRenderer,
    workflowRenderer,
}: AutoEntityCardProps<TData>) {
    const cardFields = fields.toCardFields(data);
    
    const hasOverrideTitle = title !== undefined;
    const displayTitle = hasOverrideTitle ? title : (cardFields[0]?.value ?? '---');
    const restFields = hasOverrideTitle ? cardFields : cardFields.slice(2);

    // 1. Classify fields by variant
    const { headerRight, center: declarativeCenter, body } = classifyFieldsByVariant(restFields, variant)

    // 2. Build subtitle from registry or explicit
    const subtitleItems = buildSubtitleItems(entityLabel, data, subtitle, title, cardFields[0])

    // 3. Build Header Right content with proper sizing
    const headerRightContent = headerRight.length > 0 && (
        <div className="flex items-center gap-4">
            {headerRight.map(f => (
                <div key={f.key} className={cn("flex flex-col items-end", f.cardClassName)}>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">{f.label}</span>
                    <span className="text-xs font-semibold">{f.value ?? <span className="opacity-40">—</span>}</span>
                </div>
            ))}
        </div>
    );

    const combinedTrailing = (headerRightContent || trailing) ? (
        <div className="flex items-center gap-4">
            {headerRightContent}
            {trailing}
        </div>
    ) : undefined;

    // 4. Build Center content from explicit prop, declarative fields, or hubStatusRenderer
    const centerContent = center ?? (
        declarativeCenter.length > 0
            ? declarativeCenter.map(f => (
                <div key={f.key} className="text-xs text-muted-foreground line-clamp-2 text-center max-w-[400px]">
                    {f.value}
                </div>
            ))
            : undefined
    ) ?? (
        hubStatusRenderer && (variant === 'compact' || variant === 'full')
            ? hubStatusRenderer(data)
            : undefined
    )

    // 5. Render subtitle items
    const subtitleNode = subtitleItems.length > 0
        ? subtitleItems.map((item, i) => {
            if (item.kind === 'separator') return <React.Fragment key={i}> · </React.Fragment>
            if (item.kind === 'text') return <React.Fragment key={i}>{item.content}</React.Fragment>
            if (item.kind === 'date') return <React.Fragment key={i}>{String(item.value)}</React.Fragment>
            if (item.kind === 'currency') return <React.Fragment key={i}>{item.value}</React.Fragment>
            if (item.kind === 'status') return <React.Fragment key={i}>{item.label}</React.Fragment>
            return null
        })
        : undefined

    // 6. Root className for hero/flow variants
    const rootClassName = cn(
        variant === 'hero' && 'border-l-4 border-l-primary',
        variant === 'flow' && 'border-l-4 border-l-accent',
        className
    )

    // 7. Determine EntityCard variant (minimal padding if no body)
    const entityCardVariant = body.length === 0 ? "compact" : "full"

    return (
        <EntityCard defaultAction={defaultAction} onClick={onClick} isSelected={isSelected} className={rootClassName} variant={entityCardVariant}>
            <EntityCard.Header 
                icon={variant === 'hero' ? undefined : (variant === 'minimal' ? undefined : icon)}
                iconClassName={iconClassName}
                imageSrc={variant === 'hero' ? (imageSrc ?? undefined) : undefined}
                title={displayTitle} 
                subtitle={subtitleNode}
                center={centerContent}
                actions={actions}
                trailing={combinedTrailing}
            />
            {body.length > 0 && (
                <EntityCard.Body>
                    {body.map(field => (
                        variant === 'minimal'
                            ? <EntityCard.Field key={field.key} label={field.label} value={field.value} />
                            : <EntityCard.Field key={field.key} label={field.label} value={field.value} />
                    ))}
                </EntityCard.Body>
            )}
            {children}
            {variant === 'full' && workflowRenderer && (
                <EntityCard.Body>
                    {workflowRenderer(data)}
                </EntityCard.Body>
            )}
        </EntityCard>
    )
}
