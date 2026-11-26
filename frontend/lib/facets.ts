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
