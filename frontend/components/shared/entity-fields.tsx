import { type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { DataCell } from "./DataTableCells"
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

type FieldSurface = "table" | "card" | "kanban"

interface FieldDef<T> {
    key: keyof T & string
    type: FieldType
    label: string
    header?: string
    get?: (entity: T) => unknown
    cellProps?: Record<string, unknown>
    surfaces?: FieldSurface[]
    tableOptions?: {
        width?: number
        enableSorting?: boolean
        align?: "left" | "center" | "right"
    }
    kanbanOptions?: {
        priority?: "primary" | "secondary"
    }
}

export interface CardField {
    key: string
    label: string
    value: ReactNode
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
    return def.get ? def.get(entity) : entity[def.key]
}

// ─── Cell Renderers ──────────────────────────────────────────────────────────

function renderCellValue<T>(def: FieldDef<T>, entity: T): ReactNode {
    const value = resolveValue(def, entity)
    const extra = def.cellProps ?? {}

    switch (def.type) {
        case "text":
            return <DataCell.Text {...extra}>{(value as string) ?? "-"}</DataCell.Text>
        case "code":
            return <DataCell.Code {...extra}>{(value as string) ?? "-"}</DataCell.Code>
        case "date":
            return <DataCell.Date value={value as string | Date} {...extra} />
        case "currency":
            return <DataCell.Currency value={value as number | string} {...extra} />
        case "status":
            return <DataCell.Status status={value as string} {...extra} />
        case "number":
            return <DataCell.Number value={value as number | string} {...extra} />
        case "secondary":
            return <DataCell.Secondary {...extra}>{(value as string) ?? "-"}</DataCell.Secondary>
        case "contact":
            return <DataCell.ContactLink contactId={value as number | string}>{(value as string) ?? "-"}</DataCell.ContactLink>
        case "chip":
            return <DataCell.Chip {...extra}>{String(value ?? "")}</DataCell.Chip>
        case "icon": {
            const icon = extra.icon as LucideIcon | undefined
            return icon ? <DataCell.Icon icon={icon} {...extra} /> : null
        }
        case "progress":
            return <DataCell.Progress value={value as number} {...extra} />
        case "numericFlow":
            return <DataCell.NumericFlow value={value as number | string} {...extra} />
        case "currencyFlow":
            return <DataCell.CurrencyFlow value={value as number | string} direction="neutral" {...extra} />
        default:
            return <DataCell.Text>{String(value ?? "-")}</DataCell.Text>
    }
}

function renderCardCell<T>(def: FieldDef<T>, entity: T): ReactNode {
    return renderCellValue(def, entity)
}

function renderKanbanCell<T>(def: FieldDef<T>, entity: T): ReactNode {
    const value = resolveValue(def, entity)
    const base = def.cellProps ?? {}

    switch (def.type) {
        case "text":
            return <DataCell.Text size="sm" {...base}>{(value as string) ?? "-"}</DataCell.Text>
        case "code":
            return <DataCell.Code size="sm" {...base}>{(value as string) ?? "-"}</DataCell.Code>
        case "date":
            return <DataCell.Date value={value as string | Date} size="sm" {...base} />
        case "currency":
            return <DataCell.Currency value={value as number | string} size="sm" {...base} />
        case "status":
            return <DataCell.Status status={value as string} variant="dot" {...base} />
        case "number":
            return <DataCell.Number value={value as number | string} size="sm" {...base} />
        case "secondary":
            return <DataCell.Secondary size="sm" {...base}>{(value as string) ?? "-"}</DataCell.Secondary>
        case "contact":
            return <DataCell.ContactLink contactId={value as number | string}>{(value as string) ?? "-"}</DataCell.ContactLink>
        case "chip":
            return <DataCell.Chip size="xs" {...base}>{String(value ?? "")}</DataCell.Chip>
        case "icon": {
            const icon = base.icon as LucideIcon | undefined
            return icon ? <DataCell.Icon icon={icon} {...base} /> : null
        }
        case "progress":
            return <DataCell.Progress value={value as number} {...base} />
        case "numericFlow":
            return <DataCell.NumericFlow value={value as number | string} size="sm" {...base} />
        case "currencyFlow":
            return <DataCell.CurrencyFlow value={value as number | string} size="sm" direction="neutral" {...base} />
        default:
            return <DataCell.Text size="sm">{String(value ?? "-")}</DataCell.Text>
    }
}

// ─── Table Cell Renderers (for ColumnDef.cell) ───────────────────────────────

function renderRowCell<T>(def: FieldDef<T>, rowOriginal: T, rowGetValue: (key: string) => unknown): ReactNode {
    const value = def.get ? def.get(rowOriginal) : rowGetValue(def.key)
    const extra = def.cellProps ?? {}

    switch (def.type) {
        case "text":
            return <DataCell.Text {...extra}>{(value as string) ?? "-"}</DataCell.Text>
        case "code":
            return <DataCell.Code {...extra}>{(value as string) ?? "-"}</DataCell.Code>
        case "date":
            return <DataCell.Date value={value as string | Date} {...extra} />
        case "currency":
            return <DataCell.Currency value={value as number | string} {...extra} />
        case "status":
            return <DataCell.Status status={value as string} {...extra} />
        case "number":
            return <DataCell.Number value={value as number | string} {...extra} />
        case "secondary":
            return <DataCell.Secondary {...extra}>{(value as string) ?? "-"}</DataCell.Secondary>
        case "contact":
            return <DataCell.ContactLink contactId={value as number | string}>{(value as string) ?? "-"}</DataCell.ContactLink>
        case "chip":
            return <DataCell.Chip {...extra}>{String(value ?? "")}</DataCell.Chip>
        case "icon": {
            const icon = extra.icon as LucideIcon | undefined
            return icon ? <DataCell.Icon icon={icon} {...extra} /> : null
        }
        case "progress":
            return <DataCell.Progress value={value as number} {...extra} />
        case "numericFlow":
            return <DataCell.NumericFlow value={value as number | string} {...extra} />
        case "currencyFlow":
            return <DataCell.CurrencyFlow value={value as number | string} direction="neutral" {...extra} />
        default:
            return <DataCell.Text>{String(value ?? "-")}</DataCell.Text>
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
                        cell: ({ row }) =>
                            renderRowCell(
                                def,
                                row.original,
                                (key: string) => row.getValue(key),
                            ),
                        enableSorting,
                        size: def.tableOptions?.width,
                    }
                })
        },

        toCardFields: (entity: T, opts?: { only?: string[] }): CardField[] => {
            const allowed = opts?.only
            return Object.entries(defs)
                .filter(([, def]) => isPresentOnSurface(def, "card"))
                .filter(([fieldKey]) => !allowed || allowed.includes(fieldKey))
                .map(([fieldKey, def]): CardField => ({
                    key: fieldKey,
                    label: def.label,
                    value: renderCardCell(def, entity),
                }))
        },

        toKanbanFields: (entity: T, opts?: { only?: string[] }): KanbanField[] => {
            const allowed = opts?.only
            return Object.entries(defs)
                .filter(([, def]) => isPresentOnSurface(def, "kanban"))
                .filter(([fieldKey]) => !allowed || allowed.includes(fieldKey))
                .map(([fieldKey, def]): KanbanField => ({
                    key: fieldKey,
                    label: def.label,
                    value: renderKanbanCell(def, entity),
                }))
        },

        render: (fieldKey: string, entity: T): ReactNode => {
            const def = defs[fieldKey]
            if (!def) return null
            return renderCardCell(def, entity)
        },
    })
}
