"use client"

import React from "react"
import { EntityCard, headerPriorityIndex, Badge } from "@/components/shared"
import type { LucideIcon } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"
import { getEntityMetadata, getEntityIcon, type SubtitleItem } from "@/lib/entity-registry"
import { resolveStatus } from "@/lib/badge-resolvers"
import type { CardField, EntityFieldsMeta, SubtitleItem as FieldsSubtitleItem } from "@/components/shared"



export interface AutoEntityCardProps<TData> {
    /** The raw entity data */
    data: TData
    /** The fields factory returned by createEntityFields() */
    fields: {
        toCardFields: (data: TData, opts?: { only?: string[] }) => CardField[]
        /** Centralized card metadata from createEntityFields meta param */
        meta?: EntityFieldsMeta<TData>
        /** Resolve card title from Fields.ts meta config */
        resolveTitle?: (entity: TData) => React.ReactNode
        /** Resolve card subtitle from Fields.ts meta config */
        resolveSubtitle?: (entity: TData, cardFields?: CardField[]) => FieldsSubtitleItem[]
        /** Returns field keys consumed by the subtitle — to exclude from other card layout zones */
        getSubtitleExcludeKeys?: (entity: TData, cardFields?: CardField[]) => Set<string>
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
    /** Optional children to render custom blocks inside the card (escape hatch for content not expressible as fields) */
    children?: React.ReactNode
    /**
     * Unified card variant — controls layout zones, field placement, and root styling.
     * - 'highlights': dashboard/summary — header only, detail fields hidden
     * - 'summary': management, dense — header only, detail hidden
     * - 'full': management, complete — header + detail (DEFAULT)
     * - 'workflow': documents with line items — header + detail + workflow body (driven by cardConfig.workflow in entity-registry)
     * - 'overview': external DTO data — header + overviewMetrics (entity fields hidden, metrics come from overviewMetrics prop)
     */
    variant?: 'highlights' | 'summary' | 'full' | 'workflow' | 'overview'
    /**
     * Hub status renderer — called for summary/full/workflow variants to render domain-specific
     * status content in the header center area. Composes with the centerDetail fields
     * (placement 'detail' → center header); it never replaces them.
     */
    hubStatusRenderer?: (data: TData) => React.ReactNode
    /**
     * @deprecated Use variant="workflow" instead. AutoEntityCard reads cardConfig.workflow from entity-registry.
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
    /**
     * Pre-built metrics for variant='overview' — rendered instead of entity-derived metrics.
     * Each item becomes a metric column in the card body.
     */
    overviewMetrics?: Array<{ label: string; value: React.ReactNode; currency?: string }>
}

// ─── Workflow Data Extraction ─────────────────────────────────────────────────

interface WorkflowConfig {
    linesKey?: string | ((data: Record<string, unknown>) => Array<Record<string, unknown>>)
    totalKey?: string | ((data: Record<string, unknown>) => number)
    pendingKey?: string | ((data: Record<string, unknown>) => number | undefined)
    deliveryDateKey?: string | ((data: Record<string, unknown>) => string | undefined)
    dateLabel?: string
}

interface WorkflowData {
    lines: Array<{ quantity: number | string; product_name?: string }>
    total: number
    pending?: number
    deliveryDate?: string
    dateLabel: string
}

function extractWorkflowData(
    data: unknown,
    workflowConfig: WorkflowConfig | undefined,
    fallbackDateLabel: string,
): WorkflowData | null {
    if (!workflowConfig) return null

    const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>

    const linesRaw = typeof workflowConfig.linesKey === 'function'
        ? workflowConfig.linesKey(d)
        : (d[workflowConfig.linesKey ?? 'lines'] as Array<Record<string, unknown>> | undefined)
    const lines = (Array.isArray(linesRaw) ? linesRaw : []).map(l => ({
        quantity: l.quantity as number | string,
        product_name: l.product_name as string | undefined,
    }))

    if (lines.length === 0) return null

    const total = typeof workflowConfig.totalKey === 'function'
        ? workflowConfig.totalKey(d)
        : parseFloat(String(d[workflowConfig.totalKey ?? 'total'] ?? 0))

    const pending = typeof workflowConfig.pendingKey === 'function'
        ? workflowConfig.pendingKey(d)
        : (() => {
            const raw = d[workflowConfig.pendingKey ?? 'pending_amount']
            return raw != null ? parseFloat(String(raw)) : undefined
        })()

    const deliveryDate = typeof workflowConfig.deliveryDateKey === 'function'
        ? workflowConfig.deliveryDateKey(d)
        : (d[workflowConfig.deliveryDateKey ?? 'delivery_date'] as string | undefined)

    const dateLabel = workflowConfig.dateLabel ?? fallbackDateLabel

    return { lines, total, pending: pending != null && pending > 0 ? pending : undefined, deliveryDate: deliveryDate || undefined, dateLabel }
}

// ─── Field Classification ─────────────────────────────────────────────────────

interface ClassifiedFields {
    title: CardField | undefined
    header: CardField[]
    centerDetail: CardField[]
    bodyDetail: CardField[]
}

/**
 * Classifies card fields into layout zones based on their resolved placement and fieldRole.
 *
 * Header capacity rules:
 * - Fields are prioritised: complex → primary-value → flow → tag (chip/icon)
 * - If ALL selected header fields share the SAME semantic role → max 3
 * - If they have MIXED roles → max 1
 * - Overflow from header is demoted to detail.
 *
 * Subtitle fields (placement === 'subtitle') and title field are excluded from all zones.
 * Detail is capped at 10 fields.
 *
 * Variant visibility:
 * - 'highlights': body detail hidden, but centerDetail (header center) preserved
 * - 'summary': header only — detail hidden
 * - 'full' / 'workflow': all zones visible
 */
function classifyFields<TData>(
    fields: CardField[],
    variant: AutoEntityCardProps<TData>['variant'],
    subtitleFieldKeys: Set<string>,
    titleFieldKey?: string,
): ClassifiedFields {
    const title = fields.find(f => f.placement === 'title')

    // Exclude title, subtitle-placed, and subtitle-referenced fields from all zones
    const rest = fields.filter(f =>
        f.placement !== 'title' &&
        f.placement !== 'subtitle' &&
        f.key !== titleFieldKey &&
        !subtitleFieldKeys.has(f.key)
    )

    // ── Header candidate pool (priority order) ────────────────────────────────
    // complex > primary-value (total/salary first) > flow > tag — shared with
    // toColumns() via headerPriorityIndex so list and card follow the same criteria.
    const headerCandidates = rest.filter(f => f.placement === 'header')

    // Sort candidates by priority group
    const sortedCandidates = [...headerCandidates].sort((a, b) =>
        headerPriorityIndex(a.fieldRole, a.key) - headerPriorityIndex(b.fieldRole, b.key)
    )

    // Determine header capacity based on role uniformity
    const uniqueRoles = new Set(sortedCandidates.map(f => f.fieldRole))
    const maxHeader = uniqueRoles.size <= 1 ? 3 : 1

    const header = sortedCandidates.slice(0, maxHeader)
    const headerOverflow = sortedCandidates.slice(maxHeader)

    // ── Detail: explicit detail fields + ALL header overflow, max 10 ──────────
    // Cascade order: header trailing → center header
    const assignedKeys = new Set([
        ...header.map(f => f.key),
    ])
    const detailBase = rest.filter(
        f => f.placement === 'detail' && !assignedKeys.has(f.key)
    )
    let detail = [...detailBase, ...headerOverflow].slice(0, 10)

    // ── Variant visibility rules ──────────────────────────────────────────────
    switch (variant) {
        case 'highlights':
            // Header + center only — no body detail.
            // detail feeds into centerDetail (header center zone), so keep it.
            break

        case 'summary':
            // Header only — no detail
            detail = []
            break

        case 'overview':
            // All entity-derived body zones hidden (overviewMetrics prop drives content)
            detail = []
            break

        case 'workflow':
        case 'full':
        default:
            // All zones visible — already balanced above
            break
    }

    // Center routing: ALL detail fields go to the header center slot.
    // bodyDetail is always empty — 'detail' placement is now semantically 'center header'.
    // EntityCard.Body is no longer driven by auto-classification.
    const centerDetail = [...detail]
    const bodyDetail: CardField[] = []

    return { title, header, centerDetail, bodyDetail }
}


/**
 * AutoEntityCard - A standardized card component for Master Data entities.
 *
 * Automatically generates the EntityCard layout using the fields defined in `createEntityFields`.
 * - Uses `placement` metadata ('title', 'subtitle', 'header', 'detail') to position fields.
 * - Uses `variant` to control which layout zones are visible.
 * - `variant='workflow'` automatically renders the workflow body from cardConfig.workflow in entity-registry.
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
    variant,
    hubStatusRenderer,
    workflowRenderer,
    hubTrigger,
    overviewMetrics,
}: AutoEntityCardProps<TData>) {
    // Resolve variant: explicit prop > entity registry > default 'full'
    const registryVariant = entityLabel ? getEntityMetadata(entityLabel)?.viewPolicy?.cardVariant : undefined
    const effectiveVariant = variant ?? registryVariant ?? 'full'

    // entityMetadata is still needed for workflowConfig and cardConfig lookups.
    const entityMetadata = entityLabel ? getEntityMetadata(entityLabel) : undefined

    const resolvedIcon = icon ?? (entityLabel ? getEntityIcon(entityLabel) : undefined)

    const cardFields = fields.toCardFields(data)

    // Resolve subtitle field keys — Fields.ts API (data-aware); consumed fields excluded from center
    const subtitleFieldKeys = fields.getSubtitleExcludeKeys?.(data, cardFields) ?? new Set<string>()

    // 1. Classify fields into layout zones (subtitle keys exclude consumed fields from center)
    const classified = classifyFields(cardFields, effectiveVariant, subtitleFieldKeys)

    // 2. Determine display title — Fields.ts meta first, then explicit prop, then auto-detect
    const fieldsTitle = fields.resolveTitle?.(data)
    const displayTitle = fieldsTitle ?? explicitTitle ?? classified.title?.value ?? cardFields[0]?.value ?? '---'

    // 3. Build subtitle — Fields.ts meta + auto-compose is the single source of truth.
    //    The explicit subtitle prop only applies when no field-based subtitle resolves.
    const fieldsSubtitle = fields.resolveSubtitle?.(data, cardFields)
    const subtitleItems: SubtitleItem[] = (fieldsSubtitle && fieldsSubtitle.length > 0)
        ? fieldsSubtitle
        : (explicitSubtitle !== undefined ? [{ kind: 'text', content: explicitSubtitle }] : [])

    // 4. Build Header trailing content (header fields + explicit trailing)
    const showHeaderLabels = classified.header.length > 1
    const headerContent = classified.header.length > 0 && (
        <div className="flex items-center gap-4">
            {classified.header.map(f => {
                const isEmpty = f.value == null || f.value === '' || (Array.isArray(f.value) && f.value.length === 0)
                return (
                    <div key={f.key} className={cn(showHeaderLabels ? "flex flex-col items-end" : "flex items-end gap-1.5", f.cardClassName)}>
                        {showHeaderLabels && <span className="text-4xs uppercase tracking-widest text-muted-foreground/60 font-bold">{f.label}</span>}
                        <span className="text-xs font-bold">{isEmpty ? <span className="opacity-40">—</span> : f.value}</span>
                    </div>
                )
            })}
        </div>
    )

    const combinedTrailing = (headerContent || trailing) ? (
        <div className="flex items-center gap-4">
            {headerContent}
            {trailing}
        </div>
    ) : undefined

    // 5. Build Center content: explicit prop wins; otherwise compose hubStatusRenderer content
    //    with the centerDetail fields. Both live in the header center zone, so detail-placed
    //    fields (secondary, temporal, etc.) must never be dropped when a hub status renderer
    //    is present — they coexist in the same center slot.
    const showCenterLabels = classified.centerDetail.length > 1
    const centerDetailNode = classified.centerDetail.length > 0 ? (
        <div className="flex items-center gap-4 min-w-0">
            {classified.centerDetail.map(f => {
                const isEmpty = f.value == null || f.value === '' || (Array.isArray(f.value) && f.value.length === 0)
                return (
                    <div key={f.key} className={cn(showCenterLabels ? "flex flex-col items-end min-w-0" : "flex items-end gap-1.5 min-w-0", f.cardClassName)}>
                        {showCenterLabels && <span className="text-4xs uppercase tracking-widest text-muted-foreground/60 font-bold whitespace-nowrap">{f.label}</span>}
                        <span className="text-xs font-normal truncate min-w-0 [&>*]:text-xs [&>*]:font-normal">{isEmpty ? <span className="opacity-40">—</span> : f.value}</span>
                    </div>
                )
            })}
        </div>
    ) : null

    const hubStatusNode = hubStatusRenderer && (effectiveVariant === 'summary' || effectiveVariant === 'full' || effectiveVariant === 'workflow')
        ? hubStatusRenderer(data)
        : null

    const centerContent = center ?? (
        (hubStatusNode != null || centerDetailNode != null) ? (
            <div className="flex items-center gap-4 min-w-0">
                {hubStatusNode}
                {centerDetailNode}
            </div>
        ) : undefined
    )

    // 6. Render subtitle items
    const subtitleNode = subtitleItems.length > 0
        ? subtitleItems.map((item, i) => {
            if (item.kind === 'separator') return <React.Fragment key={i}> · </React.Fragment>
            if (item.kind === 'text') return <React.Fragment key={i}>{item.content}</React.Fragment>
            if (item.kind === 'date') return <React.Fragment key={i}>{formatPlainDate(String(item.value))}</React.Fragment>
            if (item.kind === 'currency') return <React.Fragment key={i}>{new Intl.NumberFormat('es-CL').format(item.value)}</React.Fragment>
            if (item.kind === 'status') {
                const { intent } = resolveStatus(item.status)
                return (
                    <Badge key={i} intent={intent} size="sm" dot className="align-middle">
                        {item.label}
                    </Badge>
                )
            }
            if (item.kind === 'chip') {
                return (
                    <Badge key={i} intent={item.intent as any} size="sm" tracking="wide" className="align-middle">
                        {item.content}
                    </Badge>
                )
            }
            if (item.kind === 'node') {
                return <React.Fragment key={i}>{item.content}</React.Fragment>
            }
            return null
        })
        : undefined

    // 7. Determine EntityCard variant (compact padding if no body detail/workflow)
    const hasBodyContent = classified.bodyDetail.length > 0
        || (effectiveVariant === 'overview' && overviewMetrics && overviewMetrics.length > 0)
    const entityCardVariant = hasBodyContent ? "full" : "compact"

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

    // 9. Extract workflow data for workflow variant (from entity-registry cardConfig)
    const workflowConfig = entityMetadata?.cardConfig?.workflow
    const fallbackDateLabel = typeof entityMetadata?.cardConfig?.dateLabel === 'function'
        ? entityMetadata.cardConfig.dateLabel({})
        : entityMetadata?.cardConfig?.dateLabel ?? 'Entrega'
    const workflowData = effectiveVariant === 'workflow' ? extractWorkflowData(data, workflowConfig, fallbackDateLabel) : null

    return (
        <EntityCard defaultAction={defaultAction} onClick={onClick} isSelected={isSelected} className={className} variant={entityCardVariant}>
            <EntityCard.Header
                icon={resolvedIcon}
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
            {effectiveVariant === 'overview' && overviewMetrics && overviewMetrics.length > 0 && (
                <EntityCard.Metrics metrics={overviewMetrics} />
            )}
            {children}
            {workflowData && (
                <EntityCard.WorkflowBody
                    lines={workflowData.lines}
                    total={workflowData.total}
                    pending={workflowData.pending}
                    deliveryDate={workflowData.deliveryDate}
                    dateLabel={workflowData.dateLabel}
                />
            )}
            {!workflowData && effectiveVariant === 'full' && workflowRenderer && (
                <EntityCard.Body>
                    {workflowRenderer(data)}
                </EntityCard.Body>
            )}
        </EntityCard>
    )
}
