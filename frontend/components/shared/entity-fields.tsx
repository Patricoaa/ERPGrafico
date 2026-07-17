import { type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { DataCell } from "./DataTableCells"
import { Chip } from "./Chip"
import { DataTableColumnHeader } from "./DataTableColumnHeader"
import type { LucideIcon } from "lucide-react"

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

type FieldSurface = "table" | "card" | "kanban"

type ChipIntent = "neutral" | "primary" | "success" | "warning" | "destructive" | "info"
type FlowDirection = "inflow" | "outflow" | "neutral"
type CategoryDomain = 'product_type' | 'tax_type' | 'transaction_type' | 'dte_type' | 'contact_type'

// ─── Card Placement System ────────────────────────────────────────────────────

/**
 * Card zones — the 4 layout regions in an EntityCard.
 * - `title`: replaces the auto-generated title (identifier field)
 * - `header`: compact badges/values in the header trailing area
 * - `detail`: label:value grid in EntityCard.Body
 * - `metric`: equal-width columns in EntityCard.Metrics
 */
export type CardPlacement = 'title' | 'header' | 'detail' | 'metric'

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
    /** Override de posicionamiento en la tarjeta (defaults from ROLE_TO_PLACEMENT) */
    cardPlacement?: CardPlacement
    /** Override del rol semántico del campo (defaults from TYPE_TO_ROLE) */
    fieldRole?: FieldRole
    /** Visual sizing for card variant: 'xs' (badge/chip), 'sm' (status/text), 'md' (label/value), 'lg' (accent) */
    cardSize?: 'xs' | 'sm' | 'md' | 'lg'
    /** Custom className applied to the DataCell in card rendering */
    cardClassName?: string
    tableOptions?: {
        width?: number
        enableSorting?: boolean
        align?: "left" | "center" | "right"
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
    toColumns: () => ColumnDef<T>[]
    toCardFields: (entity: T, opts?: { only?: string[] }) => CardField[]
    toKanbanFields: (entity: T, opts?: { only?: string[] }) => KanbanField[]
    render: (fieldKey: string, entity: T) => ReactNode
    defs: Record<string, FieldDef<T>>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPresentOnSurface<T>(def: FieldDef<T>, surface: FieldSurface): boolean {
    return !def.surfaces || def.surfaces.includes(surface)
}

function resolveValue<T>(def: FieldDef<T>, entity: T): unknown {
    return def.get ? def.get(entity) : entity[def.key as keyof T]
}

function resolveDyn<TContext>(
    prop: unknown,
    context: TContext,
): unknown {
    return typeof prop === "function" ? (prop as (ctx: TContext) => unknown)(context) : prop
}

// ─── Cell Renderers ──────────────────────────────────────────────────────────

function renderCell<T>(def: FieldDef<T>, entity: T): ReactNode {
    const value = resolveValue(def, entity)
    const extra = def.cellProps ?? {}
    const resolvedClassName = typeof def.className === "function"
        ? def.className(value, entity)
        : def.className

    switch (def.type) {
        case "text": {
            const suffixValue = typeof def.suffix === "function" ? def.suffix(entity) : def.suffix
            const text = (value as string) ?? "-"
            return <DataCell.Text className={resolvedClassName} {...extra}>{suffixValue ? `${text}${suffixValue}` : text}</DataCell.Text>
        }
        case "code":
            return <DataCell.Code className={resolvedClassName} {...extra}>{(value as string) ?? "-"}</DataCell.Code>
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
            return <DataCell.Secondary className={resolvedClassName} {...extra}>{(value as string) ?? "-"}</DataCell.Secondary>
        case "contact":
            return <DataCell.ContactLink contactId={value as number | string} className={resolvedClassName}>{(value as string) ?? "-"}</DataCell.ContactLink>
        case "chip": {
            const intentValue = typeof def.intent === "function" ? def.intent(entity) : def.intent
            return (
                <DataCell.Chip
                    className={resolvedClassName}
                    {...(intentValue !== undefined && { intent: intentValue })}
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
 *   code: { key: 'display_id', type: 'code', label: 'Folio' },
 *   date: { key: 'date', type: 'date', label: 'Fecha' },
 *   total: { key: 'total', type: 'currency', label: 'Total', get: (o) => parseFloat(o.amount) },
 * })
 *
 * // DataTable
 * const columns = orderFields.toColumns()
 *
 * // EntityCard
 * {orderFields.toCardFields(order).map(f => <EntityCard.Field key={f.key} label={f.label} value={f.value} />)}
 *
 * // Kanban
 * {orderFields.toKanbanFields(order).map(f => <div key={f.key}>{f.value}</div>)}
 *
 * // Ad-hoc
 * {orderFields.render('total', order)}
 * ```
 */
export function createEntityFields<T>(): (
    defs: Record<string, FieldDef<T>>
) => EntityFieldsReturn<T> {
    return (defs) => ({
        defs,

        toColumns: (): ColumnDef<T>[] => {
            return Object.entries(defs)
                .filter(([, def]) => isPresentOnSurface(def, "table"))
                .map(([fieldKey, def]): ColumnDef<T> => {
                    const headerLabel = def.header ?? def.label
                    const enableSorting = def.tableOptions?.enableSorting ?? true
                    const align = def.tableOptions?.align ?? "center"
                    const headerAlign = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"

                    return {
                        accessorKey: def.key,
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
                .filter(([fieldKey]) => !allowed || allowed.includes(fieldKey))
                .map(([fieldKey, def]): CardField => {
                    const role: FieldRole = def.fieldRole ?? TYPE_TO_ROLE[def.type]
                    let placement: CardPlacement = def.cardPlacement ?? ROLE_TO_PLACEMENT[role]

                    // Auto-detect title: identifier field with id/number/code in key
                    if (placement !== 'title' && role === 'identifier' && /id|number|code/i.test(fieldKey)) {
                        placement = 'title'
                    }

                    return {
                        key: fieldKey,
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
                .filter(([fieldKey]) => !allowed || allowed.includes(fieldKey))
                .map(([fieldKey, def]): KanbanField => ({
                    key: fieldKey,
                    label: def.label,
                    value: renderCell(def, entity),
                }))
        },

        render: (fieldKey: string, entity: T): ReactNode => {
            const def = defs[fieldKey]
            if (!def) return null
            return renderCell(def, entity)
        },
    })
}
