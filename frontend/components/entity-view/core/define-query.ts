import { thisMonth, thisQuarter, thisWeek, thisYear, today } from "@/lib/date-presets"
import type {
    DateFilterDef,
    DropdownFilterDef,
    GroupByOptionDef,
    MultiSelectOption,
    TextFieldDef,
    UnifiedSearchConfig,
} from "@/types/unified-search"
import type { SortSpec } from "./define-entity"

// ─── Authoring types (ADR-0158 §3, collection-toolbar §3) ────────────────────

export interface FilterOption {
    value: string
    label: string
}

/**
 * A filter is tied to an entity field (and takes its label, rule G-1 of ADR-0120) or, when no
 * column shows the concept, carries its own label. Never both.
 */
type Labeled<Id extends string> = { field: Id; label?: never } | { field?: undefined; label: string }

export type DatePreset = "today" | "this_week" | "this_month" | "this_quarter" | "this_year"

export type QueryFilter<Id extends string> = Labeled<Id> &
    (
        | {
              control: "multi"
              /** URL / server param. Defaults to the filter id. */
              param?: string
              /** Fixed domain values (G-2), or `"remote"`: resolved at runtime (`filterOptions` / facets). */
              options: readonly FilterOption[] | "remote"
              /** Show per-option counts from `facets/` (ADR-0158 §8, stage 4). */
              counts?: boolean
          }
        | {
              control: "single"
              param?: string
              options: readonly FilterOption[] | "remote"
              defaultValue?: string
          }
        | {
              control: "toggle"
              param?: string
              /** Value sent while on. Defaults to `"true"`. */
              activeValue?: string
          }
        | {
              control: "range"
              /** Default `<id>_gte` / `<id>_lte`. */
              paramFrom?: string
              paramTo?: string
          }
        | {
              control: "date"
              /** Default `<id>_after` / `<id>_before` (django-filter `DateFromToRangeFilter`). */
              paramFrom?: string
              paramTo?: string
              /** Default: every preset. A custom range is always offered. */
              presets?: readonly DatePreset[]
          }
    )

/** A field-scoped search ("Cliente: …") with its own server param and optional suggestions. */
export type SearchScope<Id extends string> = Labeled<Id> & { param: string; suggestionsUrl?: string }

export type GroupAggregate = "sum" | "avg" | "count"

export interface QueryView {
    id: string
    label: string
    /** Filter values by filter id; a list for `multi`. (`undefined` keys are ignored: inferred object literals carry them.) */
    filters?: Readonly<Record<string, string | readonly string[] | undefined>>
    /** Field ids, DRF style: `["-date"]`. */
    ordering?: readonly string[]
    groupBy?: string
    /** Tab shows its total (facets endpoint, stage 4). */
    count?: boolean
}

export interface QuerySpec<Id extends string> {
    /**
     * Free-text search goes to the `search` param; `scopes` add field-scoped searches. `placeholder` is
     * also the box's accessible name ("Buscar guías de despacho…"). Default "Buscar…".
     */
    search?: { scopes?: readonly SearchScope<Id>[]; placeholder?: string }
    filters?: Readonly<Record<string, QueryFilter<Id>>>
    /** Sortable fields; each needs an `orderBy` server key. Up to 3 keys at once. */
    sort?: { fields: readonly Id[]; default?: SortSpec<Id> }
    groupBy?: { fields: readonly Id[]; aggregate?: Partial<Record<Id, GroupAggregate>> }
    /** Predefined views only (ADR-0158 §9). The first one is the default. */
    views?: readonly QueryView[]
}

// ─── Compiled form ───────────────────────────────────────────────────────────

export const MAX_SORT_KEYS = 3

export interface CompiledSortField {
    id: string
    label: string
    /** DRF key. `null` in client mode: the loaded rows are sorted in the browser. */
    orderBy: string | null
}

export interface CompiledQuery {
    /** Search + filters + grouping in the runtime model of `useUnifiedSearch` (the controls are shared). */
    search: UnifiedSearchConfig
    /** Search box placeholder and accessible name. */
    placeholder: string
    sortFields: readonly CompiledSortField[]
    defaultSort: readonly string[]
    groupFields: readonly { id: string; label: string }[]
    aggregate: Readonly<Record<string, GroupAggregate>>
    views: readonly QueryView[]
    /** Filter id → URL params it owns (one, or from/to), for views and dirty checks. */
    filterParams: Readonly<Record<string, readonly string[]>>
}

const PRESET_DEFS: Record<DatePreset, { label: string; getValue: () => { from: string; to: string } }> = {
    today: { label: "Hoy", getValue: today },
    this_week: { label: "Esta semana", getValue: thisWeek },
    this_month: { label: "Este mes", getValue: thisMonth },
    this_quarter: { label: "Este trimestre", getValue: thisQuarter },
    this_year: { label: "Este año", getValue: thisYear },
}
const ALL_PRESETS: readonly DatePreset[] = ["today", "this_week", "this_month", "this_quarter", "this_year"]

/** What compiling reads from an entity: field labels / server keys and its `query`. */
export interface QueryEntity {
    fields: Readonly<Record<string, { label: string; orderBy?: string }>>
    query?: QuerySpec<string>
}

function labelOf(entity: QueryEntity, item: { field?: string; label?: string }): string {
    if (item.field !== undefined) {
        const def = entity.fields[item.field]
        if (!def) throw new Error(`entity-view: query usa el campo "${item.field}", que no existe`)
        return def.label
    }
    return item.label ?? ""
}

const toOptions = (options: readonly FilterOption[] | "remote"): MultiSelectOption[] =>
    options === "remote" ? [] : options.map((o) => ({ value: o.value, label: o.label }))

export interface CompileQueryOptions {
    /**
     * `server` (default): sort fields need an `orderBy` key and become DRF `ordering`. `client`: the list
     * loads every row and sorts them in the browser, so any field can sort and nothing is sent.
     */
    sorting?: "server" | "client"
}

/**
 * Compiles `entity.query` (ADR-0158 §3). Labels come from the fields (G-1); params get their
 * defaults; date presets become the shared date-filter options. Pure: memoize per entity.
 */
export function compileQuery(entity: QueryEntity, { sorting = "server" }: CompileQueryOptions = {}): CompiledQuery {
    const spec = entity.query ?? {}
    const filters: DropdownFilterDef[] = []
    const dateFilters: DateFilterDef[] = []
    const filterParams: Record<string, string[]> = {}

    for (const [id, filter] of Object.entries(spec.filters ?? {})) {
        const label = labelOf(entity, filter)
        switch (filter.control) {
            case "multi": {
                const param = filter.param ?? id
                filters.push({ type: "multi", key: id, label, serverParam: param, options: toOptions(filter.options), dynamic: filter.options === "remote" || undefined })
                filterParams[id] = [param]
                break
            }
            case "single": {
                const param = filter.param ?? id
                filters.push({ type: "single", key: id, label, serverParam: param, options: toOptions(filter.options), dynamic: filter.options === "remote" || undefined, defaultValue: filter.defaultValue })
                filterParams[id] = [param]
                break
            }
            case "toggle": {
                const param = filter.param ?? id
                filters.push({ type: "toggle", key: id, label, serverParam: param, activeValue: filter.activeValue ?? "true" })
                filterParams[id] = [param]
                break
            }
            case "range": {
                const from = filter.paramFrom ?? `${id}_gte`
                const to = filter.paramTo ?? `${id}_lte`
                filters.push({ type: "range", key: id, label, serverParamFrom: from, serverParamTo: to, placeholderFrom: "Desde", placeholderTo: "Hasta" })
                filterParams[id] = [from, to]
                break
            }
            case "date": {
                const from = filter.paramFrom ?? `${id}_after`
                const to = filter.paramTo ?? `${id}_before`
                dateFilters.push({
                    type: "date",
                    key: id,
                    label,
                    options: (filter.presets ?? ALL_PRESETS).map((p) => ({ label: PRESET_DEFS[p].label, serverParamFrom: from, serverParamTo: to, getValue: PRESET_DEFS[p].getValue })),
                })
                filterParams[id] = [from, to]
                break
            }
        }
    }

    const searchFields: TextFieldDef[] = (spec.search?.scopes ?? []).map((scope) => ({
        key: scope.param,
        label: labelOf(entity, scope),
        serverParam: scope.param,
        suggestionsUrl: scope.suggestionsUrl,
    }))

    const groupFields = (spec.groupBy?.fields ?? []).map((id) => ({ id, label: labelOf(entity, { field: id }) }))
    const groupBy: GroupByOptionDef[] = groupFields.map((g) => ({ key: g.id, label: g.label, field: g.id }))

    const sortFields = (spec.sort?.fields ?? []).map((id) => {
        const def = entity.fields[id]
        if (!def) throw new Error(`entity-view: query.sort incluye "${id}", que no existe`)
        if (sorting === "client") return { id, label: def.label, orderBy: null }
        if (!def.orderBy) throw new Error(`entity-view: query.sort incluye "${id}", que no declara orderBy`)
        return { id, label: def.label, orderBy: def.orderBy }
    })

    return {
        search: { searchFields, filters, dateFilters, groupBy },
        placeholder: spec.search?.placeholder ?? "Buscar…",
        sortFields,
        defaultSort: spec.sort?.default ? [spec.sort.default] : [],
        groupFields,
        aggregate: (spec.groupBy?.aggregate ?? {}) as Record<string, GroupAggregate>,
        views: spec.views ?? [],
        filterParams,
    }
}

/**
 * Adapter for screens that still declare a `unifiedSearchDef.ts` (ADR-0158 migration, stage 3): the
 * same compiled shape, with no sorting, views or aggregates. A screen uses this or `entity.query`, never both.
 */
export function fromUnifiedSearchDef(def: UnifiedSearchConfig): CompiledQuery {
    const filterParams: Record<string, string[]> = {}
    for (const f of def.filters ?? []) {
        if (f.type === "range") filterParams[f.key] = [f.serverParamFrom, f.serverParamTo]
        else if (f.serverParam) filterParams[f.key] = [f.serverParam]
    }
    for (const d of def.dateFilters ?? []) {
        filterParams[d.key] = [...new Set(d.options.flatMap((o) => [o.serverParamFrom, o.serverParamTo].filter((p): p is string => !!p)))]
    }
    return {
        search: def,
        placeholder: "Buscar…",
        sortFields: [],
        defaultSort: [],
        groupFields: (def.groupBy ?? []).map((g) => ({ id: g.field, label: g.label })),
        aggregate: {},
        views: [],
        filterParams,
    }
}

/**
 * DRF `ordering` for several sort keys: `["-date", "total"]` → `"-date_field,total_field,-id"`
 * (one `id` tie-break, following the first key's direction). Unknown ids are skipped.
 */
export function orderingFor(compiled: CompiledQuery, sort: readonly string[]): string | undefined {
    const keys: string[] = []
    for (const spec of sort.slice(0, MAX_SORT_KEYS)) {
        const desc = spec.startsWith("-")
        const id = desc ? spec.slice(1) : spec
        const field = compiled.sortFields.find((f) => f.id === id)
        if (field?.orderBy) keys.push(`${desc ? "-" : ""}${field.orderBy}`)
    }
    if (keys.length === 0) return undefined
    if (!keys.some((k) => k.replace(/^-/, "") === "id")) keys.push(keys[0].startsWith("-") ? "-id" : "id")
    return keys.join(",")
}
