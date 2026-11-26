import { z } from "zod"

/**
 * Facet counts of a list (ADR-0158 §8, collection-toolbar §7.2).
 * - `fields`: filter param → option value → rows that option would leave with the other filters applied.
 * - `views`: predefined view id → its rows with its own filters only.
 */
export interface FacetCounts {
    fields: Readonly<Record<string, Readonly<Record<string, number>>>>
    views: Readonly<Record<string, number>>
}

/** View id → the list params of its filters (what `facets/?views=` counts). */
export type FacetViews = Readonly<Record<string, Readonly<Record<string, string>>>>

const facetsSchema = z.object({
    fields: z.record(z.string(), z.array(z.object({ value: z.string(), count: z.number() }))),
    views: z.record(z.string(), z.number()).default({}),
})

/** A filter's value chosen in the menu but not applied yet («Aplicar · N resultados», ADR-0158 §5). */
export interface FilterDraft {
    param: string
    /** `null`: the draft clears the filter. */
    value: string | null
}

/**
 * Id of the `facets/` view that counts a draft. It carries the draft, so a count is only read for
 * the draft it was asked for (a stale response while the next one loads has a different id).
 */
export function draftViewId(draft: FilterDraft): string {
    return `draft:${draft.param}=${draft.value ?? ""}`
}

/** List params with the draft in place of its filter, without `ordering` (it does not change a count). */
export function draftViewParams(params: Readonly<Record<string, string>>, draft: FilterDraft): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) if (key !== "ordering" && key !== draft.param) out[key] = value
    if (draft.value) out[draft.param] = draft.value
    return out
}

/** Parses a `facets/` response into `FacetCounts` (validates the backend contract at the boundary). */
export function toFacetCounts(data: unknown): FacetCounts {
    const { fields, views } = facetsSchema.parse(data)
    return {
        fields: Object.fromEntries(Object.entries(fields).map(([name, items]) => [name, Object.fromEntries(items.map((i) => [i.value, i.count]))])),
        views,
    }
}

/** `facets/` query params: the list params plus the requested fields and views. */
export function facetRequestParams(params: URLSearchParams, fields: readonly string[], views: FacetViews): URLSearchParams {
    if (fields.length) params.set("fields", fields.join(","))
    if (Object.keys(views).length) params.set("views", JSON.stringify(views))
    return params
}
