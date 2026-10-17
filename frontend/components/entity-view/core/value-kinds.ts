import type { ComponentType } from "react"
import type { BadgeIntent, CategoryDomain } from "@/lib/badge-resolvers"
import type { EntityLabel } from "@/lib/entity-registry"

// ─── Primitive value shapes ──────────────────────────────────────────────────

/** Decimal transported as string by DRF (e.g. "1250.00"). */
export type DecimalString = string
/** ISO date (`YYYY-MM-DD`) or datetime string. */
export type ISODate = string
export type CurrencyCode = string
export type FlowDirection = "inflow" | "outflow" | "neutral"
export type Surface = "table" | "card" | "kanban" | "export"
export type Align = "start" | "center" | "end"

/** Status rendered by StatusBadge (invariant #7). */
export interface StatusValue {
    status: string
    label?: string
    intent?: BadgeIntent
}

type Numeric = number | DecimalString | null | undefined

// ─── Open registry of value kinds ────────────────────────────────────────────

/**
 * Open registry of semantic value kinds (ADR-0087 §2).
 *
 * The core declares the common and frequent kinds. A feature adds its own kind by
 * module augmentation of THIS module and registers its spec with `registerValueKind`:
 *
 * ```ts
 * declare module "@/components/entity-view/core/value-kinds" {
 *   interface ValueKinds { docRef: { value: DocRefValue | null; options: { fallback?: string } } }
 * }
 * ```
 *
 * A kind enters the core only when ≥3 entities from ≥2 features use it (Gate B).
 */
export interface ValueKinds {
    text: { value: string | null | undefined; options: { tone?: "default" | "secondary"; truncate?: boolean } }
    code: { value: string | number | null | undefined; options: { prefix?: string } }
    number: { value: Numeric; options: { suffix?: string; decimals?: number } }
    quantity: { value: Numeric; options: { uom?: string | null; decimals?: number } }
    money: { value: Numeric; options: { currency?: CurrencyCode; sign?: "auto" | "always" | "never" } }
    flow: { value: Numeric; options: { direction: FlowDirection; currency?: CurrencyCode } }
    date: { value: ISODate | null | undefined; options: { time?: boolean } }
    dateRange: { value: { from: ISODate; to: ISODate | null } | null; options: Record<never, never> }
    status: { value: StatusValue | null; options: Record<never, never> }
    /** Multi-axis document hub with its readable label (Gate C: same vocabulary in table and card). */
    hubStatus: { value: object | null; options: { entity: EntityLabel; caption: StatusValue } }
    contact: { value: { id: number; name: string } | null; options: Record<never, never> }
    tags: { value: readonly string[] | null; options: { domain?: CategoryDomain } }
    progress: { value: { done: number; total: number } | null; options: { format?: "percent" | "ratio" } }
}

export type ValueKind = keyof ValueKinds
export type KindValue<K extends ValueKind> = ValueKinds[K]["value"]
export type KindOptions<K extends ValueKind> = ValueKinds[K]["options"]

export interface ValueRenderProps<K extends ValueKind> {
    value: KindValue<K>
    options: KindOptions<K>
    surface: Surface
    align: Align
    /** Field label: accessible name for widgets that need one (progressbar, icon-only values). */
    label: string
}

/** Contract of a kind: pure format (export, subtitle, a11y text) + optional sort key + renderer. */
export interface ValueKindSpec<K extends ValueKind> {
    format: (value: KindValue<K>, options: KindOptions<K>) => string
    /** Sort key. Defaults to `format`. Sorting always uses the displayed semantics (fixes sort-on-raw-key). */
    sortValue?: (value: KindValue<K>, options: KindOptions<K>) => string | number | null
    /** Default alignment in tables (numbers right-aligned). */
    align?: Align
    render: ComponentType<ValueRenderProps<K>>
    /**
     * Phrasing-content renderer (spans only), used where the value sits inside a link or button
     * such as the row's primary cell. Kinds without it fall back to their formatted text there.
     */
    inline?: ComponentType<ValueRenderProps<K>>
}

type Registry = { [K in ValueKind]?: ValueKindSpec<K> }
const registry: Registry = {}

export function registerValueKind<K extends ValueKind>(kind: K, spec: ValueKindSpec<K>): void {
    // Single bridge of the registry (TS#30581): writing through a generic key widens the slot to the
    // intersection of every kind's spec. Reads (`getValueKind`) keep the correlation without a cast.
    registry[kind] = spec as Registry[K]
}

/** Resolves a registered kind. Indexing the homomorphic mapped `Registry` with `K` keeps the correlation (no cast). */
export function getValueKind<K extends ValueKind>(kind: K): ValueKindSpec<K> {
    const spec = registry[kind]
    if (!spec) {
        throw new Error(`entity-view: el tipo de valor "${String(kind)}" no está registrado`)
    }
    return spec
}
