import { type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { DataCell } from "./DataTableCells"
import { Chip } from "./Chip"
import { DataTableColumnHeader } from "./DataTableColumnHeader"
import type { LucideIcon } from "lucide-react"
export type { SubtitleItem } from "@/lib/entity-registry"
import type { SubtitleItem } from "@/lib/entity-registry"

// ─── Types ───────────────────────────────────────────────────────────────────

type FieldType =
    | "text"
    | "code"
    | "date"
    | "currency"
    | "status"
    | "number"
    | "secondary"
    | "contact"
    | "chip"
    | "icon"
    | "progress"
    | "numericFlow"
    | "currencyFlow"
    | "sourceDest"
    | "chip-category"
    | "computed"

type FieldSurface = "table" | "card" | "kanban"

type ChipIntent = "neutral" | "primary" | "success" | "warning" | "destructive" | "info"
type FlowDirection = "inflow" | "outflow" | "neutral"
type CategoryDomain = 'product_type' | 'tax_type' | 'transaction_type' | 'dte_type' | 'contact_type' | 'payment_method'

// ─── Card Placement System ────────────────────────────────────────────────────

/**
 * Card zones — the 5 layout regions in an EntityCard.
 * - `title`: replaces the auto-generated title (identifier field)
 * - `subtitle`: replaces the auto-generated subtitle (e.g. name field)
 * - `header`: compact badges/values in the header trailing area
 * - `detail`: label:value grid in EntityCard.Body
 * - `metric`: equal-width columns in EntityCard.Metrics
 * - `footer`: summary row in EntityCard.Footer (always explicit)
 */
export type CardPlacement = 'title' | 'subtitle' | 'header' | 'detail' | 'metric' | 'footer'

/**
 * Semantic role of a field — determines its default CardPlacement.
 * Each FieldType maps to a FieldRole via TYPE_TO_ROLE.
 */
export type FieldRole =
    | 'identifier'       // code field with key containing id/number/code
    | 'primary-label'    // text field with key containing 'name'
    | 'status'           // status badge
    | 'tag'              // chip / icon
    | 'primary-value'    // currency (main financial value)
    | 'secondary-value'  // currency (secondary), number metrics
    | 'flow'             // currencyFlow, numericFlow
    | 'relation'         // text (related entity name)
    | 'temporal'         // date field
    | 'descriptive'      // text (description, notes)
    | 'supplementary'    // secondary text
    | 'progress'         // progress bar

/**
 * FieldType → FieldRole mapping.
 * Used by toCardFields() when no explicit fieldRole is set.
 */
const TYPE_TO_ROLE: Record<FieldType, FieldRole> = {
    'text':          'descriptive',
    'code':          'identifier',
    'date':          'temporal',
    'currency':      'primary-value',
    'status':        'status',
    'number':        'secondary-value',
    'secondary':     'supplementary',
    'contact':       'relation',
    'chip':          'tag',
    'icon':          'tag',
    'progress':      'progress',
    'numericFlow':   'flow',
    'currencyFlow':  'flow',
    'sourceDest':    'descriptive',
    'chip-category': 'tag',
    'computed':      'descriptive',
}

/**
 * FieldRole → default CardPlacement mapping.
 * Explicit cardPlacement in FieldDef always overrides this.
 */
const ROLE_TO_PLACEMENT: Record<FieldRole, CardPlacement> = {
    'identifier':       'header',
    'primary-label':    'detail',
    'status':           'header',
    'tag':              'header',
    'primary-value':    'header',
    'secondary-value':  'metric',
    'flow':             'header',
    'relation':         'detail',
    'temporal':         'detail',
    'descriptive':      'detail',
    'supplementary':    'detail',
    'progress':         'metric',
}

interface FieldDef<T> {
    key: (keyof T & string) | (string & {}) // allow virtual keys when `get` is provided
    type: FieldType
    label: string
    header?: string
    get?: (entity: T) => unknown
    cellProps?: Record<string, unknown>
    surfaces?: FieldSurface[]
    /** Explicit left-to-right order for table columns (lower = more left). Undefined sorts last. */
    order?: number
    /**
     * Override explícito de posicionamiento en la tarjeta.
     * Evitar cuando `fieldRole` puede expresar la misma intención —
     * el auto-detector convierte `fieldRole` → `CardPlacement` automáticamente.
     * Último recurso para casos sin equivalente semántico en `FieldRole`.
     */
    cardPlacement?: CardPlacement
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

    // ── Per-row dynamic props ──────────────────────────────────────────────
    // Static value OR callback resolved per-row by the factory.
    // Callbacks return scalars only, never JSX.

    /** Conditional className — resolves per row via (parsedValue, entity). */
    className?: string | ((value: unknown, entity: T) => string)

    // Currency / CurrencyFlow
    /** Currency code — static or derived per entity. */
    currency?: string | ((entity: T) => string)
    /** Show zero values as dash — static or based on parsed numeric value. */
    showZeroAsDash?: boolean | ((value: number) => boolean)

    // Status
    /** Dynamic label override for the StatusBadge (replaces translateStatus). */
    getLabel?: (entity: T) => string

    // Chip
    /** Chip intent — static or derived from entity fields. */
    intent?: ChipIntent | ((entity: T) => ChipIntent)

    // Chip.Category
    /** Domain registry for category-based color resolution. Required for chip-category type. */
    domain?: CategoryDomain | ((entity: T) => CategoryDomain)

    // CurrencyFlow / NumericFlow
    /** Flow direction — static or derived from entity. */
    direction?: FlowDirection | ((entity: T) => FlowDirection)

    // Number / Text
    /** Suffix text — static or derived per entity (e.g. uom_name, "%"). */
    suffix?: string | ((entity: T) => string)

    // Icon prefix (text, code, secondary, chip)
    /** Optional icon prepended to the cell content. Ignored for card header rendering. */
    icon?: LucideIcon | ((entity: T) => LucideIcon)

    // Chip icon
    /** Optional icon rendered inside Chip cells. */
    chipIcon?: LucideIcon | ((entity: T) => LucideIcon)

    // Computed type
    /** Custom render callback — only used when type is 'computed'. Returns arbitrary ReactNode. */
    render?: (entity: T) => ReactNode
}

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
    /** Always resolved — from explicit cardPlacement or ROLE_TO_PLACEMENT fallback */
    cardPlacement: CardPlacement
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
    /** Resolve card title from meta.title config. Falls back to cardPlacement:'title' field, then first field. */
    resolveTitle: (entity: T) => ReactNode
    /** Resolve card subtitle from meta.subtitle config. Returns SubtitleItem[] for EntityCard.Subtitle. */
    resolveSubtitle: (entity: T) => SubtitleItem[]
    /** Field keys referenced by subtitle config — to exclude from other card layout zones. */
    getSubtitleExcludeKeys: () => Set<string>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPresentOnSurface<T>(def: FieldDef<T>, surface: FieldSurface): boolean {
    return !def.surfaces || def.surfaces.includes(surface)
}

function resolveValue<T>(def: FieldDef<T>, entity: T): unknown {
    return def.get ? def.get(entity) : entity[def.key as keyof T]
}

// ─── Cell Renderers ──────────────────────────────────────────────────────────

function resolveIcon<T>(def: FieldDef<T>, entity: T): LucideIcon | undefined {
    if (!def.icon) return undefined
     
    return typeof def.icon === 'function' ? (def.icon as (e: T) => LucideIcon)(entity) : def.icon
}

function IconPrefix({ icon: Icon }: { icon?: LucideIcon }) {
    if (!Icon) return null
    return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
}

function renderCell<T>(def: FieldDef<T>, entity: T): ReactNode {
    const value = resolveValue(def, entity)
    const extra = def.cellProps ?? {}
    const resolvedClassName = typeof def.className === "function"
        ? def.className(value, entity)
        : def.className
    const icon = resolveIcon(def, entity)

    switch (def.type) {
        case "computed":
            return def.render ? def.render(entity) : null
        case "text": {
            const suffixValue = typeof def.suffix === "function" ? def.suffix(entity) : def.suffix
            const text = (value as string) ?? "-"
            return (
                <DataCell.Text className={resolvedClassName} {...extra}>
                    <span className="flex items-center gap-1.5 justify-center">
                        <IconPrefix icon={icon} />
                        {suffixValue ? `${text}${suffixValue}` : text}
                    </span>
                </DataCell.Text>
            )
        }
        case "code":
            return (
                <DataCell.Code className={resolvedClassName} {...extra}>
                    <span className="flex items-center gap-1.5 justify-center">
                        <IconPrefix icon={icon} />
                        {(value as string) ?? "-"}
                    </span>
                </DataCell.Code>
            )
        case "date":
            return <DataCell.Date value={value as string | Date} className={resolvedClassName} {...extra} />
        case "currency": {
            const currencyValue = typeof def.currency === "function" ? def.currency(entity) : def.currency
            const showZeroAsDashValue = typeof def.showZeroAsDash === "function"
                ? def.showZeroAsDash(value as number)
                : def.showZeroAsDash
            return (
                <DataCell.Currency
                    value={value as number | string}
                    className={resolvedClassName}
                    {...(currencyValue !== undefined && { currency: currencyValue })}
                    {...(showZeroAsDashValue !== undefined && { showZeroAsDash: showZeroAsDashValue })}
                    {...extra}
                />
            )
        }
        case "status": {
            if (value === null || value === undefined || value === "") {
                return <DataCell.Text className={resolvedClassName} {...extra}>-</DataCell.Text>
            }
            const labelValue = def.getLabel ? def.getLabel(entity) : undefined
            return (
                <DataCell.Status
                    status={value as string}
                    className={resolvedClassName}
                    {...(labelValue !== undefined && { label: labelValue })}
                    {...extra}
                />
            )
        }
        case "number": {
            const suffixValue = typeof def.suffix === "function" ? def.suffix(entity) : def.suffix
            return (
                <DataCell.Number
                    value={value as number | string}
                    className={resolvedClassName}
                    {...(suffixValue !== undefined && { suffix: suffixValue })}
                    {...extra}
                />
            )
        }
        case "secondary":
            return (
                <DataCell.Secondary className={resolvedClassName} {...extra}>
                    <span className="flex items-center gap-1.5 justify-center">
                        <IconPrefix icon={icon} />
                        {(value as string) ?? "-"}
                    </span>
                </DataCell.Secondary>
            )
        case "contact":
            return <DataCell.ContactLink contactId={value as number | string} className={resolvedClassName}>{(value as string) ?? "-"}</DataCell.ContactLink>
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
                    {...extra}
                >
                    {String(value ?? "")}
                </DataCell.Chip>
            )
        }
        case "chip-category": {
            const domainValue = (typeof def.domain === "function" ? def.domain(entity) : def.domain) as CategoryDomain
            const values = (Array.isArray(value) ? value : value ? [value] : []) as string[]
            return (
                <div className={cn("flex gap-1 flex-wrap", resolvedClassName)}>
                    {values.map((v, i) => (
                        <Chip.Category key={i} domain={domainValue} value={v} size="sm" />
                    ))}
                </div>
            )
        }
        case "icon": {
            const icon = extra.icon as LucideIcon | undefined
            return icon ? <DataCell.Icon icon={icon} className={resolvedClassName} {...extra} /> : null
        }
        case "progress":
            return <DataCell.Progress value={value as number} className={resolvedClassName} {...extra} />
        case "numericFlow":
            return <DataCell.NumericFlow value={value as number | string} className={resolvedClassName} {...extra} />
        case "currencyFlow": {
            const directionValue = typeof def.direction === "function" ? def.direction(entity) : def.direction
            const currencyValue = typeof def.currency === "function" ? def.currency(entity) : def.currency
            return (
                <DataCell.CurrencyFlow
                    value={value as number | string}
                    direction={directionValue ?? "neutral"}
                    className={resolvedClassName}
                    {...(currencyValue !== undefined && { currency: currencyValue })}
                    {...extra}
                />
            )
        }
        case "sourceDest": {
            const v = value as { source: string; dest: string; sourceEntity?: { label: string; entityLabel: string; id: number }; destEntity?: { label: string; entityLabel: string; id: number } }
            return <DataCell.SourceDest {...v} className={resolvedClassName} {...extra} />
        }
        default:
            return <DataCell.Text className={resolvedClassName}>{String(value ?? "-")}</DataCell.Text>
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
                if (v != null) { resolved = v; break }
            }
        }

        if (resolved == null || resolved === undefined) {
            if (isConditional && items.length > 0 && items[items.length - 1].kind === 'text') {
                items.pop()
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
function extractTemplateKeys<T>(template: string): Set<string> {
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
            return Object.entries(defs)
                .filter(([fieldKey, def]) => isPresentOnSurface(def, "table") && !excluded.has(fieldKey))
                .sort(([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity))
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
                        cell: ({ row }) => renderCell(def, row.original),
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
         * Each field gets a resolved cardPlacement and fieldRole:
         * - Explicit fieldRole overrides TYPE_TO_ROLE
         * - Explicit cardPlacement overrides ROLE_TO_PLACEMENT
         * - Title field (identifier with id/number/code key) gets 'title' placement
         */
        toCardFields: (entity: T, opts?: { only?: string[] }): CardField[] => {
            const allowed = opts?.only
            const fields = Object.entries(defs)
                .filter(([, def]) => isPresentOnSurface(def, "card"))
                .filter(([, def]) => !allowed || allowed.includes(def.key))
                .map(([, def]): CardField => {
                    const role: FieldRole = def.fieldRole ?? TYPE_TO_ROLE[def.type]
                    let placement: CardPlacement = def.cardPlacement ?? ROLE_TO_PLACEMENT[role]

                    // Auto-detect title: identifier field whose key contains id/number/code/display.
                    // Covers: display_id, number, code, period_display, folio_display, etc.
                    if (placement !== 'title' && role === 'identifier' && /id|number|code|display/i.test(def.key)) {
                        placement = 'title'
                    }

                    // Auto-detect subtitle: primary-label or descriptive field whose key contains name.
                    if (placement !== 'subtitle' && (role === 'primary-label' || role === 'descriptive') && /name/i.test(def.key)) {
                        placement = 'subtitle'
                    }

                    return {
                        key: def.key,
                        label: def.label,
                        value: renderCell(def, entity),
                        cardPlacement: placement,
                        fieldRole: role,
                        ...(def.cardClassName && { cardClassName: def.cardClassName }),
                    }
                })

            // Ensure exactly one title — if none found, first identifier or first field
            const hasTitle = fields.some(f => f.cardPlacement === 'title')
            if (!hasTitle && fields.length > 0) {
                const titleCandidate = fields.find(f => f.fieldRole === 'identifier') ?? fields[0]
                titleCandidate.cardPlacement = 'title'
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
                const def = Object.values(defs).find(d => d.key === meta.title!.field)
                if (def) return renderCell(def, entity)
                // Fallback: raw value from entity
                const raw = entity[meta.title.field as keyof T]
                if (raw != null) return String(raw)
            }
            // Priority 3: field with cardPlacement:'title' (backwards compat)
            const cardTitleField = Object.values(defs).find(d => d.cardPlacement === 'title')
            if (cardTitleField) return renderCell(cardTitleField, entity)
            // Priority 4: first identifier field
            const identifier = Object.values(defs).find(d => {
                const role = d.fieldRole ?? TYPE_TO_ROLE[d.type]
                return role === 'identifier'
            })
            if (identifier) return renderCell(identifier, entity)
            // Priority 5: first field
            const first = Object.values(defs)[0]
            if (first) return renderCell(first, entity)
            return '---'
        },

        resolveSubtitle: (entity: T): SubtitleItem[] => {
            // Priority 1: meta.subtitle.renderer (complex JSX)
            if (meta?.subtitle?.renderer) {
                return meta.subtitle.renderer(entity)
            }
            // Priority 2: meta.subtitle.field (simple single-field)
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
            // Priority 3: field with cardPlacement:'subtitle' (auto-detected or explicit)
            const cardSubtitleField = Object.values(defs).find(d => {
                const role = d.fieldRole ?? TYPE_TO_ROLE[d.type]
                let placement = d.cardPlacement ?? ROLE_TO_PLACEMENT[role]
                if (placement !== 'subtitle' && (role === 'primary-label' || role === 'descriptive') && /name/i.test(d.key)) {
                    placement = 'subtitle'
                }
                return placement === 'subtitle'
            })
            if (cardSubtitleField) {
                const raw = entity[cardSubtitleField.key as keyof T]
                if (raw != null && raw !== undefined) {
                    const items: SubtitleItem[] = [{ kind: 'text', content: String(raw) }]
                    if (meta?.subtitle?.suffixTemplate) {
                        const suffixItems = parseSubtitleTemplate(meta.subtitle.suffixTemplate, entity)
                        if (suffixItems.length > 0) {
                            items.push({ kind: 'separator' })
                            items.push(...suffixItems)
                        }
                    }
                    return items
                }
            }
            // Priority 4: meta.subtitle.template
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
            return []
        },

        getSubtitleExcludeKeys: (): Set<string> => {
            const keys = new Set<string>()
            if (meta?.subtitle?.field) keys.add(meta.subtitle.field)
            if (meta?.subtitle?.excludeKeys) {
                for (const k of meta.subtitle.excludeKeys) keys.add(k)
            }
            if (meta?.subtitle?.template) {
                for (const k of Array.from(extractTemplateKeys(meta.subtitle.template))) keys.add(k)
            }
            if (meta?.subtitle?.suffixTemplate) {
                for (const k of Array.from(extractTemplateKeys(meta.subtitle.suffixTemplate))) keys.add(k)
            }
            return keys
        },
    })
}
