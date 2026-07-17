"use client"

import React from "react"
import { EntityCard } from "@/components/shared"
import type { LucideIcon } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"
import { renderEntitySubtitleItems, getEntityMetadata, getSubtitleFieldKeys, type SubtitleItem } from "@/lib/entity-registry"
import type { CardField } from "@/components/shared"

export interface AutoEntityCardProps<TData> {
    /** The raw entity data */
    data: TData
    /** The fields factory returned by createEntityFields() */
    fields: {
        toCardFields: (data: TData, opts?: { only?: string[] }) => CardField[]
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
    /** Optional image URL to render in the header icon slot (takes precedence over icon) */
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
     * - 'highlights': dashboard/summary — header only, detail/metric fields hidden
     * - 'summary': management, dense — header + metrics, detail hidden
     * - 'full': management, complete — header + detail + metrics (DEFAULT)
     */
    variant?: 'highlights' | 'summary' | 'full'
    /**
     * Hub status renderer — called for summary/full variants to render domain-specific
     * status content in the header center area.
     */
    hubStatusRenderer?: (data: TData) => React.ReactNode
    /**
     * Workflow renderer — called for full variant to render workflow body content
     * (line items, totals, pending, delivery date).
     */
    workflowRenderer?: (data: TData) => React.ReactNode
    /**
     * Hub trigger config — when provided, renders a hub-trigger button
     * (ArrowLeft/ArrowRight) in the header actions slot.
     * Mirrors the visual feedback of `createHubTriggerColumn` for DataTable rows.
     */
    hubTrigger?: {
        /** Whether the hub is currently open for this card */
        isSelected: boolean
        /** Toggle handler */
        onToggle: () => void
    }
}

// ─── Field Classification ─────────────────────────────────────────────────────

interface ClassifiedFields {
    title: CardField | undefined
    header: CardField[]
    centerDetail: CardField[]
    bodyDetail: CardField[]
    metric: CardField[]
}

/**
 * Classifies card fields into layout zones based on their resolved cardPlacement.
 * Applies variant-based visibility rules.
 *
 * Fields referenced by subtitle templates (via subtitleFieldKeys) are excluded
 * from all zones to prevent duplicate rendering with the subtitle.
 *
 * Detail field routing:
 * - Flow fields (numericFlow/currencyFlow) → center of header
 * - Other detail fields → center of header UNLESS flow fields are present,
 *   in which case they stay in body.
 */
function classifyFields<TData>(
    fields: CardField[],
    variant: AutoEntityCardProps<TData>['variant'],
    subtitleFieldKeys: Set<string>,
): ClassifiedFields {
    const title = fields.find(f => f.cardPlacement === 'title')

    // Exclude title and subtitle-referenced fields from layout zones
    const rest = fields.filter(f =>
        f.cardPlacement !== 'title' &&
        !subtitleFieldKeys.has(f.key)
    )

    let detail = rest.filter(f => f.cardPlacement === 'detail')
    let metric = rest.filter(f => f.cardPlacement === 'metric')
    const flows = rest.filter(f => f.fieldRole === 'flow')
    const header = rest.filter(f => f.cardPlacement === 'header' && f.fieldRole !== 'flow')

    // Apply variant visibility
    switch (variant) {
        case 'highlights':
            // Header + center — detail fields route to center via centerDetail, hide metric
            metric = []
            break

        case 'summary':
            // Header + metric — hide detail
            detail = []
            break

        case 'full':
        default:
            // All zones visible — balance header if too many
            if (header.length > 3) {
                const excess = header.splice(3)
                detail.unshift(...excess)
            }
            break
    }

    // Center routing: flow fields or detail fields go to header center
    const centerDetail = flows.length > 0 ? flows : detail
    const bodyDetail = flows.length > 0 ? detail : []

    return { title, header, centerDetail, bodyDetail, metric }
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
 * - Uses `cardPlacement` metadata ('title', 'header', 'detail', 'metric') to position fields.
 * - Uses `variant` to control which layout zones are visible.
 * - Supports `hubStatusRenderer` for summary/full variants.
 * - Supports `workflowRenderer` for full variant.
 * - Auto-generates subtitle from registry when no explicit subtitle is provided.
 */
export function AutoEntityCard<TData>({ 
    data, 
    fields, 
    entityLabel,
    title: explicitTitle,
    subtitle: explicitSubtitle,
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
    hubTrigger,
}: AutoEntityCardProps<TData>) {
    // Resolve variant: explicit prop > entity registry > default 'full'
    const registryVariant = entityLabel ? getEntityMetadata(entityLabel)?.viewPolicy?.cardVariant : undefined
    const effectiveVariant = variant ?? registryVariant ?? 'full'

    // Resolve subtitle field keys from registry templates to exclude from layout zones
    const subtitleFieldKeys = entityLabel ? getSubtitleFieldKeys(entityLabel) : new Set<string>()

    const cardFields = fields.toCardFields(data)
    
    // 1. Classify fields into layout zones
    const classified = classifyFields(cardFields, effectiveVariant, subtitleFieldKeys)

    // 2. Determine display title
    const displayTitle = explicitTitle ?? classified.title?.value ?? cardFields[0]?.value ?? '---'

    // 3. Build subtitle from registry or explicit
    const subtitleItems = buildSubtitleItems(entityLabel, data, explicitSubtitle, explicitTitle, cardFields[0])

    // 4. Build Header trailing content (header fields + explicit trailing)
    const headerContent = classified.header.length > 0 && (
        <div className="flex items-center gap-4">
            {classified.header.map(f => (
                <div key={f.key} className={cn("flex flex-col items-end", f.cardClassName)}>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">{f.label}</span>
                    <span className="text-xs font-semibold">{f.value ?? <span className="opacity-40">—</span>}</span>
                </div>
            ))}
        </div>
    )

    const combinedTrailing = (headerContent || trailing) ? (
        <div className="flex items-center gap-4">
            {headerContent}
            {trailing}
        </div>
    ) : undefined

    // 5. Build Center content: explicit prop → hubStatusRenderer → centerDetail fields
    const centerDetailNode = classified.centerDetail.length > 0 && (
        <div className="flex items-center gap-4 min-w-0">
            {classified.centerDetail.map(f => (
                <div key={f.key} className={cn("flex flex-col items-end min-w-0", f.cardClassName)}>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold whitespace-nowrap">{f.label}</span>
                    <span className="text-xs font-semibold truncate min-w-0">{f.value ?? <span className="opacity-40">—</span>}</span>
                </div>
            ))}
        </div>
    )

    const centerContent = center ?? (
        hubStatusRenderer && (effectiveVariant === 'summary' || effectiveVariant === 'full')
            ? hubStatusRenderer(data)
            : centerDetailNode || undefined
    )

    // 6. Render subtitle items
    const subtitleNode = subtitleItems.length > 0
        ? subtitleItems.map((item, i) => {
            if (item.kind === 'separator') return <React.Fragment key={i}> · </React.Fragment>
            if (item.kind === 'text') return <React.Fragment key={i}>{item.content}</React.Fragment>
            if (item.kind === 'date') return <React.Fragment key={i}>{formatPlainDate(String(item.value))}</React.Fragment>
            if (item.kind === 'currency') return <React.Fragment key={i}>{new Intl.NumberFormat('es-CL').format(item.value)}</React.Fragment>
            if (item.kind === 'status') return <React.Fragment key={i}>{item.label}</React.Fragment>
            return null
        })
        : undefined

    // 7. Determine EntityCard variant (compact padding if no body detail/metric)
    const entityCardVariant = (classified.bodyDetail.length === 0 && classified.metric.length === 0) ? "compact" : "full"

    // 8. Build combined actions: existing actions + hub trigger
    const hubTriggerNode = hubTrigger ? (
        <EntityCard.HubTrigger
            isSelected={hubTrigger.isSelected}
            onToggle={hubTrigger.onToggle}
        />
    ) : null

    const combinedActions = hubTriggerNode ? (
        <>
            {actions}
            {hubTriggerNode}
        </>
    ) : actions

    return (
        <EntityCard defaultAction={defaultAction} onClick={onClick} isSelected={isSelected} className={className} variant={entityCardVariant}>
            <EntityCard.Header 
                icon={icon}
                iconClassName={iconClassName}
                imageSrc={imageSrc ?? undefined}
                title={displayTitle} 
                subtitle={subtitleNode}
                center={centerContent}
                actions={combinedActions}
                trailing={combinedTrailing}
            />
            {classified.bodyDetail.length > 0 && (
                <EntityCard.Body>
                    {classified.bodyDetail.map(field => (
                        <EntityCard.Field key={field.key} label={field.label} value={field.value} />
                    ))}
                </EntityCard.Body>
            )}
            {classified.metric.length > 0 && (
                <EntityCard.Metrics metrics={classified.metric.map(f => ({
                    label: f.label,
                    value: f.value,
                }))} />
            )}
            {children}
            {effectiveVariant === 'full' && workflowRenderer && (
                <EntityCard.Body>
                    {workflowRenderer(data)}
                </EntityCard.Body>
            )}
        </EntityCard>
    )
}
