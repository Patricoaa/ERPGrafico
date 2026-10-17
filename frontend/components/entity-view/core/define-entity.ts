import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"
import type { EntityLabel } from "@/lib/entity-registry"
import { getValueKind, type Align, type KindOptions, type KindValue, type ValueKind } from "./value-kinds"

// ─── Accessors & row-aware options ───────────────────────────────────────────

/** Keys of `T` whose value is assignable to `V`. Typos and incompatible keys fail to compile (TY-1, TY-2). */
export type KeysOfType<T, V> = { [P in keyof T]-?: T[P] extends V ? P : never }[keyof T] & string

/** A field reads its value from a compatible key or from a typed accessor function. */
export type Accessor<T, V> = KeysOfType<T, V> | ((row: T) => V)

/** Every option may be a constant or a per-row function (replaces the per-type callbacks of createEntityFields). */
export type RowAware<O, T> = { [P in keyof O]: O[P] | ((row: T) => O[P]) }

export interface FieldMeta {
    label: string
    /** Column header when it differs from the label. */
    header?: string
    /** Defaults to true. */
    sortable?: boolean
    /** Overrides the kind's default table alignment. */
    align?: Align
}

export type FieldDef<T, K extends ValueKind = ValueKind> = FieldMeta & {
    readonly kind: K
    readonly accessor: Accessor<T, KindValue<K>>
    readonly options: RowAware<KindOptions<K>, T>
}

type FieldInput<T, K extends ValueKind> = FieldMeta & RowAware<KindOptions<K>, T>

function splitMeta<T, K extends ValueKind>(input: FieldInput<T, K>): { meta: FieldMeta; options: RowAware<KindOptions<K>, T> } {
    const { label, header, sortable, align, ...options } = input
    // `options` is exactly the RowAware part of the input; TS cannot narrow a generic Omit back to it.
    return { meta: { label, header, sortable, align }, options: options as unknown as RowAware<KindOptions<K>, T> }
}

/** Builders bound to the row type `T`. `value()` reaches any registered kind, including feature extensions. */
export interface FieldBuilders<T> {
    value: <K extends ValueKind>(kind: K, accessor: Accessor<T, KindValue<K>>, input: FieldInput<T, K>) => FieldDef<T, K>
    text: (accessor: Accessor<T, KindValue<"text">>, input: FieldInput<T, "text">) => FieldDef<T, "text">
    code: (accessor: Accessor<T, KindValue<"code">>, input: FieldInput<T, "code">) => FieldDef<T, "code">
    number: (accessor: Accessor<T, KindValue<"number">>, input: FieldInput<T, "number">) => FieldDef<T, "number">
    quantity: (accessor: Accessor<T, KindValue<"quantity">>, input: FieldInput<T, "quantity">) => FieldDef<T, "quantity">
    money: (accessor: Accessor<T, KindValue<"money">>, input: FieldInput<T, "money">) => FieldDef<T, "money">
    flow: (accessor: Accessor<T, KindValue<"flow">>, input: FieldInput<T, "flow">) => FieldDef<T, "flow">
    date: (accessor: Accessor<T, KindValue<"date">>, input: FieldInput<T, "date">) => FieldDef<T, "date">
    dateRange: (accessor: Accessor<T, KindValue<"dateRange">>, input: FieldInput<T, "dateRange">) => FieldDef<T, "dateRange">
    status: (accessor: Accessor<T, KindValue<"status">>, input: FieldInput<T, "status">) => FieldDef<T, "status">
    hubStatus: (accessor: Accessor<T, KindValue<"hubStatus">>, input: FieldInput<T, "hubStatus">) => FieldDef<T, "hubStatus">
    contact: (accessor: Accessor<T, KindValue<"contact">>, input: FieldInput<T, "contact">) => FieldDef<T, "contact">
    tags: (accessor: Accessor<T, KindValue<"tags">>, input: FieldInput<T, "tags">) => FieldDef<T, "tags">
    progress: (accessor: Accessor<T, KindValue<"progress">>, input: FieldInput<T, "progress">) => FieldDef<T, "progress">
}

function makeBuilders<T>(): FieldBuilders<T> {
    const value = <K extends ValueKind>(kind: K, accessor: Accessor<T, KindValue<K>>, input: FieldInput<T, K>): FieldDef<T, K> => {
        const { meta, options } = splitMeta(input)
        return { ...meta, kind, accessor, options }
    }
    return {
        value,
        text: (a, i) => value("text", a, i),
        code: (a, i) => value("code", a, i),
        number: (a, i) => value("number", a, i),
        quantity: (a, i) => value("quantity", a, i),
        money: (a, i) => value("money", a, i),
        flow: (a, i) => value("flow", a, i),
        date: (a, i) => value("date", a, i),
        dateRange: (a, i) => value("dateRange", a, i),
        status: (a, i) => value("status", a, i),
        hubStatus: (a, i) => value("hubStatus", a, i),
        contact: (a, i) => value("contact", a, i),
        tags: (a, i) => value("tags", a, i),
        progress: (a, i) => value("progress", a, i),
    }
}

// ─── Field resolution (format / sort / render inputs) ────────────────────────

export function readValue<T, K extends ValueKind>(def: FieldDef<T, K>, row: T): KindValue<K> {
    const { accessor } = def
    if (typeof accessor === "function") return accessor(row)
    return row[accessor] as KindValue<K>
}

export function resolveOptions<T, K extends ValueKind>(def: FieldDef<T, K>, row: T): KindOptions<K> {
    const out: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(def.options as Record<string, unknown>)) {
        out[key] = typeof raw === "function" ? (raw as (r: T) => unknown)(row) : raw
    }
    return out as KindOptions<K>
}

export interface ResolvedField<K extends ValueKind> {
    kind: K
    value: KindValue<K>
    options: KindOptions<K>
    text: string
}

export function resolveField<T, K extends ValueKind>(def: FieldDef<T, K>, row: T): ResolvedField<K> {
    const spec = getValueKind(def.kind)
    const value = readValue(def, row)
    const options = resolveOptions(def, row)
    return { kind: def.kind, value, options, text: spec.format(value, options) }
}

export function sortValueOf<T, K extends ValueKind>(def: FieldDef<T, K>, row: T): string | number | null {
    const spec = getValueKind(def.kind)
    const value = readValue(def, row)
    const options = resolveOptions(def, row)
    return spec.sortValue ? spec.sortValue(value, options) : spec.format(value, options)
}

export function alignOf<T, K extends ValueKind>(def: FieldDef<T, K>): Align {
    return def.align ?? getValueKind(def.kind).align ?? "start"
}

// ─── Layouts per surface (P5: semantics shared, layout not) ──────────────────

export type SortSpec<Id extends string> = Id | `-${Id}`

export interface TableLayout<Id extends string> {
    readonly columns: readonly Id[]
    /** Column rendered as the accessible link/button that opens the row (AX-3). Defaults to the first column. */
    readonly primary?: Id
    readonly defaultSort?: SortSpec<Id>
    readonly footer?: { readonly sum?: readonly Id[] }
}

export type CardTone = "default" | "primary" | "info" | "success" | "warning" | "destructive" | "muted"

export interface CardMedia<T> {
    /** Static icon. Default: the registry icon of the entity label. */
    icon?: LucideIcon
    /** Per-row icon (e.g. by movement type); wins over `icon`. */
    iconFor?: (row: T) => LucideIcon
    tone?: CardTone | ((row: T) => CardTone)
    image?: (row: T) => string | null | undefined
    avatar?: ComponentType<{ row: T }>
}

/** Registrable body sections. `custom` is the typed per-feature escape (receives the row, lives in the feature). */
export type CardSection<T, Id extends string> =
    | { readonly kind: "workflow"; readonly total: Id; readonly pending?: Id; readonly date?: Id; readonly lines?: Id }
    | { readonly kind: "progress"; readonly field: Id }
    | { readonly kind: "metrics"; readonly fields: readonly Id[] }
    | { readonly kind: "custom"; readonly component: ComponentType<{ row: T }> }

export interface CardLayout<T, Id extends string> {
    readonly title: Id
    readonly subtitle?: readonly Id[]
    readonly meta?: readonly Id[]
    readonly trailing?: readonly Id[]
    readonly media?: CardMedia<T>
    readonly body?: CardSection<T, Id>
}

export interface ViewsInput<T, Id extends string> {
    table?: TableLayout<Id>
    card?: CardLayout<T, Id>
}

export interface BoundTableLayout<Id extends string> extends TableLayout<Id> {
    /** Same layout without some columns. Ids are checked at compile time (TC-012 cannot happen). */
    without: (...ids: Id[]) => BoundTableLayout<Id>
}

function bindTable<Id extends string>(layout: TableLayout<Id>): BoundTableLayout<Id> {
    return {
        ...layout,
        without: (...ids: Id[]) => bindTable({ ...layout, columns: layout.columns.filter((c) => !ids.includes(c)) }),
    }
}

// ─── Entity ──────────────────────────────────────────────────────────────────

export type FieldMap<T> = Record<string, FieldDef<T, ValueKind>>

export interface ExportSpec<Filters> {
    /** Feature hook (export-formats.md: one hook per export, no generic useExport). */
    useExport: () => { run: (format: ExportFormat, filters: Filters) => void; isPending: boolean }
    formats: readonly ExportFormat[]
}
export type ExportFormat = "xlsx" | "csv" | "pdf"

/**
 * Identity of an entity, one of two:
 * - `label`: registry label (icon, URL, drawer stay in entity-registry). An unregistered label does not compile (R8).
 * - `title`: embedded rows without a sheet of their own (document lines). No default open action and no
 *   registry icon; the title is the collection's accessible name.
 */
export type EntityIdentity =
    | { label: EntityLabel; title?: undefined }
    | { title: string; label?: undefined }

/** Display name of an entity: its registry label or its title. */
export function entityName(identity: EntityIdentity): string {
    return identity.label !== undefined ? identity.label : identity.title
}

export type EntitySpec<T, F extends FieldMap<T>> = EntityIdentity & {
    fields: F
    /** Facet dimensions for filters, independent from visible columns. */
    facets?: Record<string, (row: T) => string | null | undefined>
    export?: ExportSpec<Record<string, unknown>>
    /** Stable row id. Defaults to `row.id`. */
    rowId?: (row: T) => string | number
}

export type Entity<T, F extends FieldMap<T>> = EntitySpec<T, F> & {
    readonly ids: readonly FieldId<F>[]
    field: <Id extends FieldId<F>>(id: Id) => F[Id]
    views: <V extends ViewsInput<T, FieldId<F>>>(views: V) => {
        table: V["table"] extends TableLayout<FieldId<F>> ? BoundTableLayout<FieldId<F>> : undefined
        card: V["card"]
    }
}

export type FieldId<F> = Extract<keyof F, string>

/**
 * Entity definition (ADR-0087 §1). Usage:
 *
 * ```ts
 * export const uomEntity = defineEntity<UoM>()((f) => ({
 *   label: "inventory.uom",
 *   fields: { name: f.text("name", { label: "Nombre" }) },
 * }))
 * ```
 */
export function defineEntity<T>() {
    return <F extends FieldMap<T>>(build: (f: FieldBuilders<T>) => EntitySpec<T, F>): Entity<T, F> => {
        const spec = build(makeBuilders<T>())
        const ids = Object.keys(spec.fields) as FieldId<F>[]
        return {
            ...spec,
            ids,
            field: (id) => spec.fields[id],
            views: (views) => ({
                table: (views.table ? bindTable(views.table) : undefined) as never,
                card: views.card as never,
            }),
        }
    }
}

/** Untyped-id lookup used by the surfaces (ids were already checked when the layout was declared). */
export function fieldById<T>(entity: EntityIdentity & { fields: FieldMap<T> }, id: string): FieldDef<T, ValueKind> {
    const def = entity.fields[id]
    if (!def) throw new Error(`entity-view: el campo "${id}" no existe en ${entityName(entity)}`)
    return def
}

export function rowIdOf<T, F extends FieldMap<T>>(entity: Entity<T, F>, row: T): string {
    if (entity.rowId) return String(entity.rowId(row))
    const id = (row as { id?: unknown }).id
    return id === undefined || id === null ? "" : String(id)
}

