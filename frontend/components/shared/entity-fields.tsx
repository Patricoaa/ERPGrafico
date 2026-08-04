import { type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { cn, translateStatus } from "@/lib/utils"
import { DataCell } from "./DataTableCells"
import type { DataCellIntent, DataCellSize, DataCellWeight } from "./DataTableCells"
import { DataTableColumnHeader } from "./DataTableColumnHeader"
import type { CategoryDomain } from "@/lib/badge-resolvers"
import type { LucideIcon } from "lucide-react"
export type { SubtitleItem } from "@/lib/entity-registry"
import type { SubtitleItem } from "@/lib/entity-registry"

// ─── Types ───────────────────────────────────────────────────────────────────

type FieldType =
    | "text"
    | "code"
    | "date"
    | "dateTime"
    | "currency"
    | "status"
    | "number"
    | "secondary"
    | "contact"
    | "chip"
    | "chip-category"
    | "currencyFlow"
    | "numericFlow"
    | "sourceDest"
    | "computed"

type FieldSurface = "table" | "card" | "kanban"

type ChipIntent = "neutral" | "primary" | "success" | "warning" | "destructive" | "info"
type FlowDirection = "inflow" | "outflow" | "neutral"

// ─── Placement System ─────────────────────────────────────────────────────────

/**
 * Semantic placement zones — used for BOTH card layout AND list column ordering.
 *
 * Card layout regions in an EntityCard:
 * - `title`: replaces the auto-generated title (identifier field)
 * - `subtitle`: replaces the auto-generated subtitle
 * - `header`: compact badges/values in the header trailing area
 * - `detail`: **routed to the header center zone** (label:value columns alongside flows).
 *
 * List column ordering (left → right):
 * `title` → `subtitle` → `detail` → `header`
 * The `subtitle` zone mirrors the card's auto-composed subtitle (role priority:
 * name → relation → temporal → primary-value → explicit subtitle), so list and card
 * share the same ordering criteria. The `header` zone (status, totals, flows, chips)
 * sorts last — distinctive KPIs right before the actions column. Within the same zone,
 * definition order (Object.entries insertion) is preserved, except `header` which
 * follows the card's header priority (complex → total/salary → primary-value → flow → tag).
 */
export type Placement = 'title' | 'subtitle' | 'header' | 'detail'

/**
 * Semantic role of a field — determines its default Placement.
 * Each FieldType maps to a FieldRole via TYPE_TO_ROLE.
 */
export type FieldRole =
    | 'identifier'       // code field — card title candidate (prefers key with id/display)
    | 'primary-label'    // text field with key containing 'name' — exclusive subtitle candidate
    | 'complex'          // rich multi-dimensional cell (sourceDest, domain status) — always header
    | 'tag'              // chip / icon
    | 'primary-value'    // currency or status badge — header (total/salary keys rank higher)
    | 'flow'             // currencyFlow, numericFlow — header center
    | 'relation'         // contact / text referencing another entity — subtitle candidate
    | 'temporal'         // date field — subtitle candidate
    | 'datetime'         // date+time field — always center header (never subtitle)
    | 'descriptive'      // text, number, secondary, computed — detail body
    | 'supplementary'    // secondary text — detail body

/**
 * FieldType → FieldRole mapping.
 * Used by toCardFields() when no explicit fieldRole is set.
 *
 * Key rule changes vs. legacy:
 * - `status`    → 'primary-value' (rendered as a badge but semantically a primary KPI)
 * - `number`    → 'descriptive'  (quantities/counts go to detail body, not metric)
 * - `currency`  → 'primary-value' only when key contains "total" (see toCardFields override)
 * - `sourceDest`→ 'complex'      (rich route display, always header)
 * - `complex`   → 'complex'      (new explicit rich-cell type, always header)
 */
const TYPE_TO_ROLE: Record<FieldType, FieldRole> = {
    'text':          'descriptive',
    'code':          'identifier',
    'date':          'temporal',
    'dateTime':      'datetime',       // Date+time — always center header, never subtitle
    'currency':      'primary-value',  // Header KPI — total/salary keys rank higher via classifyFields priority
    'status':        'primary-value',  // Status badges are primary KPIs
    'number':        'descriptive',    // Quantities/counts → detail body
    'secondary':     'supplementary',
    'contact':       'relation',
    'chip':          'tag',
    'currencyFlow':  'flow',
    'numericFlow':   'flow',
    'sourceDest':    'complex',        // Rich route display → always header
    'chip-category': 'tag',
    'computed':      'descriptive',
}

/**
 * FieldRole → default Placement mapping.
 * Explicit placement in FieldDef always overrides this.
 *
 * Hierarchy: title → header → subtitle → detail
 * - Header is controlled by classifyFields() capacity rules, not just this map.
 * - 'tag' and 'flow' default to 'header'.
 */
const ROLE_TO_PLACEMENT: Record<FieldRole, Placement> = {
    'identifier':       'header',      // Promoted to 'title' by auto-detect in toCardFields
    'primary-label':    'subtitle',    // Promoted to 'subtitle' when key contains 'name'
    'complex':          'header',      // Always header — highest priority zone
    'tag':              'header',      // Chips/icons — header
    'primary-value':    'header',      // Totals/status badges — header
    'flow':             'header',      // Flow fields — routed to header center in classifyFields
    'relation':         'detail',      // Subtitle candidate in auto-subtitle; otherwise center header
    'temporal':         'detail',      // Subtitle candidate in auto-subtitle; otherwise center header
    'datetime':         'detail',      // Date+time — center header, never subtitle
    'descriptive':      'detail',      // Default body
    'supplementary':    'detail',      // Secondary text → body
}

/**
 * Surface-agnostic field definition — shared across every FieldType.
 * Type-specific options live on the discriminated union below.
 */
interface SharedFieldDef<T> {
    key: (keyof T & string) | (string & {}) // allow virtual keys when `get` is provided
    label: string
    header?: string
    get?: (entity: T) => unknown
    surfaces?: FieldSurface[]
    /**
     * Ubicación semántica del campo — fuente de verdad para orden en card Y list.
     * En lista: title(0) → subtitle(1) → detail(2) → header(3).
     * Dentro de la misma zona, los campos siguen el orden de definición.
     * Evitar cuando `fieldRole` puede expresar la misma intención —
     * el auto-detector convierte `fieldRole` → `Placement` automáticamente.
     */
    placement?: Placement
    /**
     * Override del rol semántico del campo (defaults from TYPE_TO_ROLE).
     * **Requerido para `type: 'computed'`**: sin este override, el campo cae en
     * `'descriptive' → 'detail'` por defecto. Usar el rol que describe mejor la
     * intención visual: `'status'` → header badge, `'identifier'` → título,
     * `'primary-value'` → header valor monetario, etc.
     */
    fieldRole?: FieldRole
    /** Visual sizing for card variant: 'xs' (badge/chip), 'sm' (status/text), 'md' (label/value), 'lg' (accent) */
    cardSize?: 'xs' | 'sm' | 'md' | 'lg'
    /** Custom className applied to the DataCell in card rendering */
    cardClassName?: string
    tableOptions?: {
        width?: number
        enableSorting?: boolean
        align?: "left" | "center" | "right"
        /** Custom sorting function — overrides default alphanumeric sort */
        sortingFn?: (rowA: { original: T }, rowB: { original: T }, columnId: string) => number
        /** Custom filter function — for multi-select or complex filters */
        filterFn?: (row: { original: T }, id: string, value: unknown) => boolean
        /** Custom accessor function — overrides accessorKey for computed/nested values */
        accessorFn?: (row: T) => unknown
    }
    kanbanOptions?: {
        priority?: "primary" | "secondary"
    }

    /** Conditional className — resolves per row via (parsedValue, entity). */
    className?: string | ((value: unknown, entity: T) => string)
}

/**
 * Discriminated union — each FieldType carries ONLY its valid options.
 * A type-specific prop outside its member is a compile error.
 * `render` exists exclusively on `computed`/`complex`.
 */
type FieldDef<T> = SharedFieldDef<T> & (
    // ── Text-like (optional icon prefix) ─────────────────────────────────────
    | { type: 'text'; icon?: LucideIcon | ((entity: T) => LucideIcon) }
    | { type: 'secondary'; icon?: LucideIcon | ((entity: T) => LucideIcon) }
    | { type: 'code'; icon?: LucideIcon | ((entity: T) => LucideIcon) }

    // ── Dates ────────────────────────────────────────────────────────────────
    | { type: 'date' }
    | { type: 'dateTime'; dateWeight?: DataCellWeight; timeWeight?: DataCellWeight }

    // ── Money & quantities ───────────────────────────────────────────────────
    | {
        type: 'currency'
        currency?: string | ((entity: T) => string)
        showZeroAsDash?: boolean | ((value: number) => boolean)
        tooltip?: string | ((entity: T) => string)
        showColor?: boolean
        intent?: DataCellIntent
        weight?: DataCellWeight
        size?: DataCellSize
    }
    | {
        type: 'number'
        suffix?: string | ((entity: T) => string)
        suffixGap?: boolean
        weight?: DataCellWeight
    }

    // ── Status ───────────────────────────────────────────────────────────────
    | { type: 'status'; getLabel?: (entity: T) => string }

    // ── Relation ─────────────────────────────────────────────────────────────
    | { type: 'contact' }

    // ── Tags ─────────────────────────────────────────────────────────────────
    | {
        type: 'chip'
        intent?: ChipIntent | ((entity: T) => ChipIntent)
        chipIcon?: LucideIcon | ((entity: T) => LucideIcon)
    }
    | { type: 'chip-category'; domain?: CategoryDomain | ((entity: T) => CategoryDomain) }

    // ── Flow ─────────────────────────────────────────────────────────────────
    | {
        type: 'currencyFlow'
        direction?: FlowDirection | ((entity: T) => FlowDirection)
        currency?: string | ((entity: T) => string)
        showIcon?: boolean
    }
    | {
        type: 'numericFlow'
        direction?: FlowDirection | ((entity: T) => FlowDirection)
        unit?: string | ((entity: T) => string)
        showIcon?: boolean
        showSign?: boolean
    }
    | { type: 'sourceDest' }

    // ── Custom renderer ──────────────────────────────────────────────────────
    // `computed` is the sole escape hatch. `fieldRole: 'complex'` reproduces the
    // legacy always-header rich-cell routing (see headerPriorityIndex).
    | { type: 'computed'; render: (entity: T) => ReactNode }
)

// ─── Card Metadata (Title / Subtitle) ────────────────────────────────────────

/** Configuration for the card title — declarative in Fields.ts meta. */
export interface CardTitleConfig<T> {
    /** Field key that provides the title value */
    field: (keyof T & string)
    /** Optional template for computed titles (e.g. '{month_display} {year}'). Supports {field}, {?field}, {f1|f2|'default'}. */
    template?: string
}

/** Configuration for the card subtitle — declarative in Fields.ts meta. */
export interface CardSubtitleConfig<T> {
    /** Simple single-field subtitle */
    field?: (keyof T & string)
    /** Template with: {field}, {?field} (conditional), {f1|f2|'default'} (fallback), {field:date}, {field:currency} */
    template?: string
    /** Suffix template appended after " · " separator — same syntax as template */
    suffixTemplate?: string
    /** Function-based subtitle renderer for complex JSX/computed subtitles (escape hatch) */
    renderer?: (entity: T) => SubtitleItem[]
    /** Explicit field keys excluded from card layout zones when this subtitle is rendered (required when renderer is used) */
    excludeKeys?: string[]
}

/** Centralized metadata for card title/subtitle — the single source of truth. */
export interface EntityFieldsMeta<T> {
    title?: CardTitleConfig<T>
    subtitle?: CardSubtitleConfig<T>
}

export interface CardField {
    key: string
    label: string
    value: ReactNode
    /** Always resolved — from explicit placement or ROLE_TO_PLACEMENT fallback */
    placement: Placement
    /** Always resolved — from explicit fieldRole or TYPE_TO_ROLE fallback */
    fieldRole: FieldRole
    /** Optional custom className for the card field container */
    cardClassName?: string
}

export interface KanbanField {
    key: string
    label: string
    value: ReactNode
}

export type EntityFieldsReturn<T> = {
    toColumns: (opts?: { exclude?: string[] }) => ColumnDef<T>[]
    toCardFields: (entity: T, opts?: { only?: string[] }) => CardField[]
    toKanbanFields: (entity: T, opts?: { only?: string[] }) => KanbanField[]
    render: (fieldKey: string, entity: T) => ReactNode
    defs: Record<string, FieldDef<T>>
    /** Centralized card metadata — title/subtitle config from createEntityFields meta param. */
    meta?: EntityFieldsMeta<T>
    /** Resolve card title from meta.title config. Falls back to placement:'title' field, then first field. */
    resolveTitle: (entity: T) => ReactNode
    /** Resolve card subtitle from meta.subtitle config. Returns SubtitleItem[] for EntityCard.Subtitle.
     *  @param cardFields - resolved CardField[] from toCardFields() — used to skip fields already assigned to title. */
    resolveSubtitle: (entity: T, cardFields?: CardField[]) => SubtitleItem[]
    /** Returns field keys consumed by the subtitle — used by AutoEntityCard to exclude them from card zones.
     *  Prevents duplicate rendering (e.g. date in subtitle AND center detail). */
    getSubtitleExcludeKeys: (entity: T, cardFields?: CardField[]) => Set<string>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPresentOnSurface<T>(def: FieldDef<T>, surface: FieldSurface): boolean {
    return !def.surfaces || def.surfaces.includes(surface)
}

function resolveValue<T>(def: FieldDef<T>, entity: T): unknown {
    return def.get ? def.get(entity) : entity[def.key as keyof T]
}

/**
 * Card header priority index — mirrors AutoEntityCard.classifyFields header ordering.
 * Lower wins. Used by toColumns() so the list's header zone follows the same criteria
 * as the card.
 */
export function headerPriorityIndex(role: FieldRole, key: string): number {
    if (role === 'complex') return 0
    if (role === 'primary-value' && /total|salary/i.test(key)) return 1
    if (role === 'primary-value') return 2
    if (role === 'flow') return 3
    if (role === 'tag') return 4
    return 99
}

// ─── Cell Renderers ──────────────────────────────────────────────────────────

function resolveIcon<T>(def: { icon?: LucideIcon | ((entity: T) => LucideIcon) }, entity: T): LucideIcon | undefined {
    if (!def.icon) return undefined
    return typeof def.icon === 'function' ? (def.icon as (e: T) => LucideIcon)(entity) : def.icon
}

function IconPrefix({ icon: Icon }: { icon?: LucideIcon }) {
    if (!Icon) return null
    return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
}

/** Unified missing-data convention: null / undefined / '' → fallback (default '-'). */
function toDisplayValue(value: unknown, fallback = "-"): string {
    if (value === null || value === undefined || value === "") return fallback
    return String(value)
}

function renderCell<T>(def: FieldDef<T>, entity: T, opts?: { weight?: DataCellWeight }): ReactNode {
    const value = resolveValue(def, entity)
    const { weight } = opts ?? {}
    const resolvedClassName = typeof def.className === "function"
        ? def.className(value, entity)
        : def.className

    switch (def.type) {
        case "computed":
            // Sole escape hatch — arbitrary ReactNode via `render`.
            // `fieldRole: 'complex'` routes to the header zone (headerPriorityIndex).
            return def.render ? def.render(entity) : null

        case "text": {
            const icon = resolveIcon(def, entity)
            return (
                <DataCell.Text className={resolvedClassName} {...(weight !== undefined && { weight })}>
                    <span className="flex items-center gap-1.5 justify-center">
                        <IconPrefix icon={icon} />
                        {toDisplayValue(value)}
                    </span>
                </DataCell.Text>
            )
        }
        case "code": {
            const icon = resolveIcon(def, entity)
            return (
                <DataCell.Code className={resolvedClassName} {...(weight !== undefined && { weight })}>
                    <span className="flex items-center gap-1.5 justify-center">
                        <IconPrefix icon={icon} />
                        {toDisplayValue(value)}
                    </span>
                </DataCell.Code>
            )
        }
        case "secondary": {
            const icon = resolveIcon(def, entity)
            return (
                <DataCell.Secondary className={resolvedClassName} {...(weight !== undefined && { weight })}>
                    <span className="flex items-center gap-1.5 justify-center">
                        <IconPrefix icon={icon} />
                        {toDisplayValue(value)}
                    </span>
                </DataCell.Secondary>
            )
        }

        case "date":
            return (
                <DataCell.Date
                    value={value as string | Date}
                    className={resolvedClassName}
                    {...(weight !== undefined && { weight })}
                />
            )
        case "dateTime":
            return (
                <DataCell.Date
                    value={value as string | Date}
                    showTime
                    dateWeight={def.dateWeight}
                    timeWeight={def.timeWeight}
                    className={resolvedClassName}
                    {...(weight !== undefined && { weight })}
                />
            )

        case "currency": {
            const currencyValue = typeof def.currency === "function" ? def.currency(entity) : def.currency
            const showZeroAsDashValue = typeof def.showZeroAsDash === "function"
                ? def.showZeroAsDash(value as number)
                : def.showZeroAsDash
            const tooltipValue = typeof def.tooltip === "function" ? def.tooltip(entity) : def.tooltip
            const resolvedWeight = def.weight ?? weight
            return (
                <DataCell.Currency
                    value={value as number | string}
                    className={resolvedClassName}
                    {...(currencyValue !== undefined && { currency: currencyValue })}
                    {...(showZeroAsDashValue !== undefined && { showZeroAsDash: showZeroAsDashValue })}
                    {...(tooltipValue !== undefined && { tooltip: tooltipValue })}
                    {...(def.showColor !== undefined && { showColor: def.showColor })}
                    {...(def.intent !== undefined && { intent: def.intent })}
                    {...(resolvedWeight !== undefined && { weight: resolvedWeight })}
                    {...(def.size !== undefined && { size: def.size })}
                />
            )
        }
        case "number": {
            const suffixValue = typeof def.suffix === "function" ? def.suffix(entity) : def.suffix
            const resolvedWeight = def.weight ?? weight
            return (
                <DataCell.Number
                    value={value as number | string}
                    className={resolvedClassName}
                    {...(suffixValue !== undefined && { suffix: suffixValue })}
                    {...(def.suffixGap !== undefined && { suffixGap: def.suffixGap })}
                    {...(resolvedWeight !== undefined && { weight: resolvedWeight })}
                />
            )
        }

        case "status": {
            if (value === null || value === undefined || value === "") {
                return (
                    <DataCell.Text className={resolvedClassName} {...(weight !== undefined && { weight })}>
                        -
                    </DataCell.Text>
                )
            }
            const labelValue = def.getLabel ? def.getLabel(entity) : undefined
            return (
                <DataCell.Status
                    status={value as string}
                    className={resolvedClassName}
                    {...(labelValue !== undefined && { label: labelValue })}
                />
            )
        }

        case "contact":
            return <DataCell.ContactLink contactId={value as number | string} className={resolvedClassName}>{toDisplayValue(value)}</DataCell.ContactLink>

        case "chip": {
            const intentValue = typeof def.intent === "function" ? def.intent(entity) : def.intent
            const chipIconValue = typeof def.chipIcon === "function"
                ? (def.chipIcon as (e: T) => LucideIcon)(entity)
                : def.chipIcon
            return (
                <DataCell.Chip
                    className={resolvedClassName}
                    {...(intentValue !== undefined && { intent: intentValue })}
                    {...(chipIconValue != null && { icon: chipIconValue })}
                >
                    {toDisplayValue(value)}
                </DataCell.Chip>
            )
        }
        case "chip-category": {
            const domainValue = typeof def.domain === "function" ? def.domain(entity) : def.domain
            return (
                <DataCell.Category value={value as string | string[]} domain={domainValue} className={resolvedClassName} />
            )
        }

        case "currencyFlow": {
            const directionValue = typeof def.direction === "function" ? def.direction(entity) : def.direction
            const currencyValue = typeof def.currency === "function" ? def.currency(entity) : def.currency
            return (
                <DataCell.CurrencyFlow
                    value={value as number | string}
                    direction={directionValue ?? "neutral"}
                    className={resolvedClassName}
                    {...(currencyValue !== undefined && { currency: currencyValue })}
                    {...(def.showIcon !== undefined && { showIcon: def.showIcon })}
                    {...(weight !== undefined && { weight })}
                />
            )
        }
        case "numericFlow": {
            const directionValue = typeof def.direction === "function" ? def.direction(entity) : def.direction
            const unitValue = typeof def.unit === "function" ? def.unit(entity) : def.unit
            return (
                <DataCell.NumericFlow
                    value={value as number | string}
                    className={resolvedClassName}
                    {...(directionValue !== undefined && { direction: directionValue })}
                    {...(unitValue !== undefined && { unit: unitValue })}
                    {...(def.showIcon !== undefined && { showIcon: def.showIcon })}
                    {...(def.showSign !== undefined && { showSign: def.showSign })}
                    {...(weight !== undefined && { weight })}
                />
            )
        }
        case "sourceDest": {
            const v = value as { source: string; dest: string; sourceEntity?: { label: string; entityLabel: string; id: number }; destEntity?: { label: string; entityLabel: string; id: number } }
            return <DataCell.SourceDest {...v} className={resolvedClassName} />
        }
    }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Resolves a template string like '{field}', '{?field}', '{f1|f2|'default'}' against entity data.
 * Returns the resolved string, or undefined if all references are null/missing.
 */
function resolveTemplate<T>(template: string, entity: T): string | undefined {
    const regex = /\{(\??)([^}]+)\}/g
    let result = ''
    let lastIndex = 0
    let hasValue = false
    let match: RegExpExecArray | null

    while ((match = regex.exec(template)) !== null) {
        const isConditional = match[1] === '?'
        const inner = match[2]
        const [rawPath] = inner.split(':')
        const alternatives = rawPath.split('|')

        let resolved: unknown = undefined
        for (const alt of alternatives) {
            const a = alt.trim()
            if (a.startsWith("'") && a.endsWith("'")) {
                if (resolved == null) resolved = a.slice(1, -1)
            } else {
                const v = resolvePath(a, entity)
                if (v != null) { resolved = v; break }
            }
        }

        if (resolved == null || resolved === undefined) {
            if (isConditional) {
                lastIndex = regex.lastIndex
                continue
            }
            return undefined
        }

        if (match.index > lastIndex) {
            result += template.slice(lastIndex, match.index)
        }
        result += String(resolved)
        hasValue = true
        lastIndex = regex.lastIndex
    }

    if (lastIndex < template.length) {
        result += template.slice(lastIndex)
    }

    return hasValue ? result : (template.includes('{') ? undefined : template)
}

/** Resolve a dotted path (e.g. 'contact.name') against an entity object. */
function resolvePath<T>(path: string, entity: T): unknown {
    let value: unknown = entity
    for (const part of path.split('.')) {
        if (value !== null && typeof value === 'object') {
            value = (value as Record<string, unknown>)[part]
        } else {
            return undefined
        }
    }
    return value
}

/**
 * Builds SubtitleItem[] from a template string and entity data.
 * Reuses the same syntax as entity-registry: {field}, {?field}, {f1|f2|'default'}, {field:date}, {field:currency}
 */
function parseSubtitleTemplate<T>(template: string, entity: T): SubtitleItem[] {
    const items: SubtitleItem[] = []
    const regex = /\{(\??)([^}]+)\}/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(template)) !== null) {
        const isConditional = match[1] === '?'
        const inner = match[2]
        const [rawPath, format] = inner.split(':')
        const alternatives = rawPath.split('|')

        let resolved: unknown = undefined
        for (const alt of alternatives) {
            const a = alt.trim()
            if (a.startsWith("'") && a.endsWith("'")) {
                if (resolved == null) resolved = a.slice(1, -1)
            } else {
                const v = resolvePath(a, entity)
                if (v != null && v !== '') { resolved = v; break }
            }
        }

        if (resolved == null || resolved === undefined || resolved === '') {
            if (isConditional) {
                const literalBefore = template.slice(lastIndex, match.index)
                const last = items[items.length - 1]
                if (last && last.kind === 'text' && literalBefore && last.content === literalBefore) {
                    items.pop()
                }
            }
            lastIndex = regex.lastIndex
            continue
        }

        if (match.index > lastIndex && !(isConditional && (resolved == null || resolved === undefined))) {
            items.push({ kind: 'text', content: template.slice(lastIndex, match.index) })
        }

        if (format === 'date') {
            items.push({ kind: 'date', value: String(resolved) })
        } else if (format === 'currency') {
            items.push({ kind: 'currency', value: Number(resolved) })
        } else {
            items.push({ kind: 'text', content: String(resolved) })
        }
        lastIndex = regex.lastIndex
    }

    if (lastIndex < template.length) {
        const tail = template.slice(lastIndex)
        if (tail) items.push({ kind: 'text', content: tail })
    }

    return items
}

/**
 * Extracts field keys referenced by a subtitle template string.
 */
function extractTemplateKeys(template: string): Set<string> {
    const keys = new Set<string>()
    const regex = /\{(\??)([^}]+)\}/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(template)) !== null) {
        const inner = match[2]
        const [rawPath] = inner.split(':')
        const alternatives = rawPath.split('|')
        for (const alt of alternatives) {
            const a = alt.trim()
            if (a.startsWith("'") && a.endsWith("'")) continue
            keys.add(a.split('.')[0])
        }
    }
    return keys
}

/**
 * Computes the card's auto-composed subtitle field order.
 * Shared between resolveSubtitle (card rendering) and toColumns (list ordering) so both
 * surfaces follow the same criteria: primary-label (name) → relation → temporal →
 * primary-value → explicit placement:'subtitle', up to 4 slots.
 *
 * Data-aware: when `entity` is provided, only fields whose value is non-null are included
 * (used by the card). Each slot evaluates all matching candidates in definition order and
 * picks the first present one — an absent candidate never blocks a later one of the same role.
 * When `entity` is omitted (static mode, used by toColumns), all candidate fields are assumed
 * present so the column order stays stable.
 */
function buildSubtitleOrder<T>(
    defs: Record<string, FieldDef<T>>,
    titleKeys: Set<string>,
    entity?: T,
): string[] {
    const allDefs = Object.values(defs)
    const isPresent = (key: string): boolean => {
        if (entity === undefined) return true
        const raw = entity?.[key as keyof T]
        return raw != null && raw !== ''
    }

    const order: string[] = []

    const nameDef = allDefs.find(d => {
        if (titleKeys.has(d.key)) return false
        const r = d.fieldRole ?? TYPE_TO_ROLE[d.type]
        if (!((r === 'primary-label' || r === 'descriptive') && /name/i.test(d.key))) return false
        return isPresent(d.key)
    })
    if (nameDef) order.push(nameDef.key)

    const slotRoles: FieldRole[] = ['relation', 'temporal', 'primary-value']
    for (const slotRole of slotRoles) {
        if (order.length >= 4) break
        const candidate = allDefs.find(d => {
            if (titleKeys.has(d.key)) return false
            if (order.includes(d.key)) return false
            if (d.placement && d.placement !== 'subtitle') return false
            const r = d.fieldRole ?? TYPE_TO_ROLE[d.type]
            if (r !== slotRole) return false
            if (d.type === 'currency' && !/total/i.test(d.key)) return false
            return isPresent(d.key)
        })
        if (candidate) order.push(candidate.key)
    }

    const explicitSubtitleFields = allDefs.filter(d =>
        d.placement === 'subtitle' && !titleKeys.has(d.key) && !order.includes(d.key)
    )
    for (const d of explicitSubtitleFields) {
        if (order.length >= 4) break
        if (isPresent(d.key)) order.push(d.key)
    }

    return order
}

/**
 * Computes which field keys the auto-compose subtitle (Priority 4) would consume.
 * Set view of buildSubtitleOrder — used by getSubtitleExcludeKeys to keep the card
 * from rendering the same field twice.
 */
function computeAutoComposeKeys<T>(
    defs: Record<string, FieldDef<T>>,
    entity: T,
    titleKeys: Set<string>,
): Set<string> {
    return new Set(buildSubtitleOrder(defs, titleKeys, entity))
}

/**
 * createEntityFields — Generic factory for entity field definitions shared between
 * DataTable (ColumnDef), EntityCard (Field), and Kanban card surfaces.
 *
 * Defines fields once and generates the correct representation for each surface,
 * eliminating the DRY violation of re-mapping the same data → DataCell per view.
 *
 * Supports per-row dynamic props via callbacks:
 * - `className`: conditional styling based on value/entity
 * - `getLabel`: dynamic StatusBadge label
 * - `intent`: dynamic Chip intent
 * - `direction`: dynamic CurrencyFlow/NumericFlow direction
 * - `suffix`: dynamic Number/Text suffix (e.g. UoM, "%")
 * - `showZeroAsDash`: dynamic zero handling
 * - `currency`: dynamic currency code
 *
 * Usage:
 * ```tsx
 * const orderFields = createEntityFields<Order>()({
 *   code: { key: 'display_id', type: 'code', label: 'Folio', order: 10 },
 *   date: { key: 'date', type: 'date', label: 'Fecha', order: 20 },
 *   total: { key: 'total', type: 'currency', label: 'Total', order: 30, get: (o) => parseFloat(o.amount) },
 * }, {
 *   title: { field: 'display_id' },
 *   subtitle: { field: 'customer_name' },
 * })
 *
 * // DataTable — columns sorted by `order`
 * const columns = orderFields.toColumns()
 *
 * // EntityCard — title/subtitle auto-resolved from meta
 * const title = orderFields.resolveTitle(order)
 * const subtitle = orderFields.resolveSubtitle(order)
 *
 * // Kanban
 * {orderFields.toKanbanFields(order).map(f => <div key={f.key}>{f.value}</div>)}
 * ```
 */
export function createEntityFields<T>(): (
    defs: Record<string, FieldDef<T>>,
    meta?: EntityFieldsMeta<T>
) => EntityFieldsReturn<T> {
    return (defs, meta?) => ({
        defs,
        meta,

        toColumns: (opts?: { exclude?: string[] }): ColumnDef<T>[] => {
            const excluded = new Set(opts?.exclude ?? [])
            const ZONE_ORDER: Record<Placement, number> = {
                title: 0, subtitle: 1, detail: 2, header: 3,
            }

            // Pre-resolve effective placement per field (mirrors toCardFields auto-title logic).
            // Resolution: explicit placement → fieldRole → TYPE_TO_ROLE → auto-title promotion.
            const resolvedPlacements = new Map<string, Placement>()
            let titleAssigned = false
            const tableEntries = Object.entries(defs).filter(
                ([k, d]) => isPresentOnSurface(d, "table") && !excluded.has(k),
            )

            for (const [, def] of tableEntries) {
                if (def.placement) {
                    resolvedPlacements.set(def.key, def.placement)
                    if (def.placement === 'title') titleAssigned = true
                    continue
                }
                const role = def.fieldRole ?? TYPE_TO_ROLE[def.type]
                let placement: Placement = ROLE_TO_PLACEMENT[role]

                // Auto-title: first identifier with code/id/display in key → title
                if (!titleAssigned && role === 'identifier' && /number|code|id|display/i.test(def.key)) {
                    placement = 'title'
                    titleAssigned = true
                }
                resolvedPlacements.set(def.key, placement)
            }

            // Fallback: if no title assigned, first identifier or first field gets title
            if (!titleAssigned && tableEntries.length > 0) {
                const fallback =
                    tableEntries.find(([, d]) => (d.fieldRole ?? TYPE_TO_ROLE[d.type]) === 'identifier')
                    ?? tableEntries[0]
                resolvedPlacements.set(fallback[1].key, 'title')
            }

            // Mirror the card's auto-composed subtitle (role priority) so the list follows
            // the same ordering criteria as the card. Static mode — no entity available.
            const titleKeys = new Set<string>()
            for (const [key, placement] of resolvedPlacements) {
                if (placement === 'title') titleKeys.add(key)
            }
            const subtitleOrder = buildSubtitleOrder(defs, titleKeys)

            return tableEntries
                .map(([fieldKey, def], index) => {
                    const subtitleIndex = subtitleOrder.indexOf(def.key)
                    if (subtitleIndex !== -1) {
                        return { entry: [fieldKey, def] as const, zone: 1, rank: subtitleIndex, index }
                    }
                    const zone = resolvedPlacements.get(def.key) ?? 'detail'
                    const zoneOrder = ZONE_ORDER[zone] ?? 3
                    const rank = zone === 'header'
                        ? headerPriorityIndex(def.fieldRole ?? TYPE_TO_ROLE[def.type], def.key)
                        : index
                    return { entry: [fieldKey, def] as const, zone: zoneOrder, rank, index }
                })
                .sort((a, b) => a.zone - b.zone || a.rank - b.rank || a.index - b.index)
                .map(({ entry }) => entry)
                .map(([fieldKey, def]): ColumnDef<T> => {
                    const headerLabel = def.header ?? def.label
                    const enableSorting = def.tableOptions?.enableSorting ?? true
                    const align = def.tableOptions?.align ?? "center"
                    const headerAlign = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
                    const hasAccessorFn = !!def.tableOptions?.accessorFn

                    return {
                        ...(hasAccessorFn
                            ? { id: fieldKey, accessorFn: (row: T) => def.tableOptions?.accessorFn?.(row) ?? null }
                            : { accessorKey: def.key }
                        ),
                        header: ({ column }) => (
                            <DataTableColumnHeader
                                column={column}
                                title={headerLabel}
                                className={cn(headerAlign)}
                            />
                        ),
                        cell: ({ row }) => {
                            const zone = resolvedPlacements.get(def.key)
                            return renderCell(def, row.original, {
                                weight: zone === 'header' ? 'semibold' : undefined,
                            })
                        },
                        meta: { title: headerLabel },
                        enableSorting,
                        size: def.tableOptions?.width,
                        ...(def.tableOptions?.sortingFn && { sortingFn: def.tableOptions.sortingFn as never }),
                        ...(def.tableOptions?.filterFn && { filterFn: def.tableOptions.filterFn as never }),
                    }
                })
        },

        /**
         * Converts field definitions into CardField[] for card rendering.
         *
         * Placement resolution pipeline (each step can be overridden by the next explicit rule):
         * 1. TYPE_TO_ROLE: field.type → semantic FieldRole
         * 2. ROLE_TO_PLACEMENT: FieldRole → default Placement
         * 3. Auto-title / auto-subtitle: first name→subtitle, first identifier→title
         * 4. Explicit fieldRole / placement on FieldDef always wins
         * 5. Cascade resolution: enforce capacity per zone, overflow to next zone
         */
        toCardFields: (entity: T, opts?: { only?: string[] }): CardField[] => {
            const allowed = opts?.only
            const usedPlacements = new Set<Placement>()

            const fields = Object.entries(defs)
                .filter(([, def]) => isPresentOnSurface(def, "card"))
                .filter(([, def]) => !allowed || allowed.includes(def.key))
                .map(([, def]): CardField => {
                    // Step 1-2: base role and placement
                    let role: FieldRole = def.fieldRole ?? TYPE_TO_ROLE[def.type]
                    let resolvedPlacement: Placement = def.placement ?? ROLE_TO_PLACEMENT[role]

                    // Step 3: Auto-title / auto-subtitle detection
                    // Only assign each placement once — fields that don't win keep their base placement.
                    if (!def.placement) {
                        const keyHasName = /name/i.test(def.key)
                        const keyHasIdOrDisplay = /id|display/i.test(def.key)
                        const keyHasCode = /number|code/i.test(def.key)

                        if (role === 'primary-label' || (role === 'descriptive' && keyHasName)) {
                            if (!usedPlacements.has('subtitle')) {
                                resolvedPlacement = 'subtitle'
                                role = 'primary-label'
                                usedPlacements.add('subtitle')
                            }
                        } else if (role === 'identifier') {
                            if ((keyHasIdOrDisplay || keyHasCode) && !usedPlacements.has('title')) {
                                resolvedPlacement = 'title'
                                usedPlacements.add('title')
                            }
                        }
                    }

                    return {
                        key: def.key,
                        label: def.label,
                        value: renderCell(def, entity, {
                            weight: resolvedPlacement === 'header' ? 'semibold' : undefined,
                        }),
                        placement: resolvedPlacement,
                        fieldRole: role,
                        ...(def.cardClassName && { cardClassName: def.cardClassName }),
                    }
                })

            // Ensure exactly one title — fallback chain:
            // 1. Any field already set to 'title'
            // 2. First 'identifier' role field in the list
            // 3. Absolute first field
            const hasTitle = fields.some(f => f.placement === 'title')
            if (!hasTitle && fields.length > 0) {
                const titleCandidate =
                    fields.find(f => f.fieldRole === 'identifier') ?? fields[0]
                titleCandidate.placement = 'title'
            }

            // ── Cascade resolution — enforce capacity per zone, overflow to next zone ──
            // Cascade order: title → subtitle → detail (header overflow demoted to detail)
            const CAP: Record<Placement, number> = {
                title: 1, subtitle: 1, header: 3,
                detail: 10,
            }
            const CASCADE_NEXT: Record<Placement, Placement> = {
                title: 'subtitle', subtitle: 'detail', header: 'detail',
                detail: 'detail',
            }
            for (const zone of ['title', 'subtitle', 'header', 'detail'] as const) {
                const inZone = fields.filter(f => f.placement === zone)
                if (inZone.length <= CAP[zone]) continue
                const overflow = inZone.slice(CAP[zone])
                for (const f of overflow) {
                    f.placement = CASCADE_NEXT[zone]
                    if (zone === 'subtitle') f.fieldRole = 'descriptive'
                }
            }

            return fields
        },

        toKanbanFields: (entity: T, opts?: { only?: string[] }): KanbanField[] => {
            const allowed = opts?.only
            return Object.entries(defs)
                .filter(([, def]) => isPresentOnSurface(def, "kanban"))
                .filter(([, def]) => !allowed || allowed.includes(def.key))
                .map(([, def]): KanbanField => ({
                    key: def.key,
                    label: def.label,
                    value: renderCell(def, entity),
                }))
        },

        render: (fieldKey: string, entity: T): ReactNode => {
            const def = defs[fieldKey]
            if (!def) return null
            return renderCell(def, entity)
        },

        resolveTitle: (entity: T): ReactNode => {
            // Priority 1: meta.title with template
            if (meta?.title?.template) {
                const resolved = resolveTemplate(meta.title.template, entity)
                if (resolved) return resolved
            }
            // Priority 2: meta.title.field
            if (meta?.title?.field) {
                const titleField = meta.title.field
                const def = Object.values(defs).find(d => d.key === titleField)
                if (def) return renderCell(def, entity, { weight: 'bold' })
                // Fallback: raw value from entity
                const raw = entity[meta.title.field as keyof T]
                if (raw != null) return String(raw)
            }
            // Priority 3: field with placement:'title' (backwards compat)
            const cardTitleField = Object.values(defs).find(d => d.placement === 'title')
            if (cardTitleField) return renderCell(cardTitleField, entity, { weight: 'bold' })
            // Priority 4: first identifier field
            const identifier = Object.values(defs).find(d => {
                const role = d.fieldRole ?? TYPE_TO_ROLE[d.type]
                return role === 'identifier'
            })
            if (identifier) return renderCell(identifier, entity, { weight: 'bold' })
            // Priority 5: first field
            const first = Object.values(defs)[0]
            if (first) return renderCell(first, entity, { weight: 'bold' })
            return '---'
        },

        resolveSubtitle: (entity: T, cardFields?: CardField[]): SubtitleItem[] => {
            // Priority 1: meta.subtitle.renderer (complex JSX escape hatch)
            if (meta?.subtitle?.renderer) {
                return meta.subtitle.renderer(entity)
            }
            // Priority 2: meta.subtitle.field (explicit single-field)
            if (meta?.subtitle?.field) {
                const raw = entity[meta.subtitle.field as keyof T]
                if (raw != null && raw !== undefined) {
                    const items: SubtitleItem[] = [{ kind: 'text', content: String(raw) }]
                    if (meta.subtitle.suffixTemplate) {
                        const suffixItems = parseSubtitleTemplate(meta.subtitle.suffixTemplate, entity)
                        if (suffixItems.length > 0) {
                            items.push({ kind: 'separator' })
                            items.push(...suffixItems)
                        }
                    }
                    return items
                }
            }
            // Priority 3: meta.subtitle.template
            if (meta?.subtitle?.template) {
                const items = parseSubtitleTemplate(meta.subtitle.template, entity)
                if (items.length > 0) {
                    if (meta.subtitle.suffixTemplate) {
                        const suffixItems = parseSubtitleTemplate(meta.subtitle.suffixTemplate, entity)
                        if (suffixItems.length > 0) {
                            items.push({ kind: 'separator' })
                            items.push(...suffixItems)
                        }
                    }
                    return items
                }
            }
            // Priority 4: Auto-compose subtitle from field roles.
            // Rule: up to 4 values in this order: name → relation → temporal → primary-value → explicit subtitle.
            // Single source of truth with toColumns() via buildSubtitleOrder — the list's subtitle
            // zone uses the exact same role priority so both surfaces agree.
            const titleKeys = new Set(
                cardFields?.filter(f => f.placement === 'title').map(f => f.key) ?? []
            )
            const subtitleKeys = buildSubtitleOrder(defs, titleKeys, entity)

            const items: SubtitleItem[] = []
            // defs is keyed by definition name (e.g. contactDisplayName), but subtitleKeys
            // are data keys (d.key, e.g. customer_name) — resolve the def by data key.
            const defByDataKey = new Map(
                Object.values(defs).map((d) => [d.key, d]),
            )

            for (const key of subtitleKeys) {
                if (items.length >= 4) break
                const def = defByDataKey.get(key)
                const raw = entity[key as keyof T]
                if (!def || raw == null || raw === '') continue
                if (items.length > 0) items.push({ kind: 'separator' })

                const role = def.fieldRole ?? TYPE_TO_ROLE[def.type]
                const isName = (role === 'primary-label' || role === 'descriptive') && /name/i.test(def.key)

                if (isName) {
                    items.push({ kind: 'text', content: String(raw) })
                } else if (def.placement === 'subtitle' && (def.type === 'chip' || def.type === 'chip-category')) {
                    const chipValue = def.get ? String(def.get(entity) ?? raw) : String(raw)
                    const chipIntent = def.type === 'chip'
                        ? (typeof def.intent === 'function' ? def.intent(entity) : def.intent)
                        : undefined
                    items.push({ kind: 'chip', content: chipValue, intent: chipIntent })
                } else if (role === 'temporal') {
                    items.push({ kind: 'date', value: String(raw) })
                } else if (role === 'primary-value' && def.type === 'currency') {
                    items.push({ kind: 'currency', value: Number(raw) })
                } else if (role === 'primary-value' && def.type === 'status') {
                    const label = def.getLabel
                        ? String(def.getLabel(entity))
                        : translateStatus(String(raw))
                    items.push({ kind: 'status', status: String(raw), label })
                } else {
                    items.push({ kind: 'text', content: String(raw) })
                }
            }

            return items
        },

        getSubtitleExcludeKeys: (entity: T, cardFields?: CardField[]): Set<string> => {
            if (meta?.subtitle?.excludeKeys) return new Set(meta.subtitle.excludeKeys)

            if (meta?.subtitle?.field) {
                const keys = new Set<string>([meta.subtitle.field])
                if (meta.subtitle.suffixTemplate) {
                    for (const k of extractTemplateKeys(meta.subtitle.suffixTemplate)) keys.add(k)
                }
                return keys
            }

            if (meta?.subtitle?.template) {
                return extractTemplateKeys(meta.subtitle.template)
            }

            const titleKeys = new Set(
                cardFields?.filter(f => f.placement === 'title').map(f => f.key) ?? []
            )
            return computeAutoComposeKeys(defs, entity, titleKeys)
        },

    })
}
