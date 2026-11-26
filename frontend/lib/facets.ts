import { z } from "zod"

/**
 * Facet counts of a list (ADR-0158 §8, collection-toolbar §7.2): filter param → option value → rows that
 * option would leave with the other filters applied.
 */
export type FacetCounts = Readonly<Record<string, Readonly<Record<string, number>>>>

const facetsSchema = z.object({
    fields: z.record(z.string(), z.array(z.object({ value: z.string(), count: z.number() }))),
})

/** Parses a `facets/` response into `FacetCounts` (validates the backend contract at the boundary). */
export function toFacetCounts(data: unknown): FacetCounts {
    const { fields } = facetsSchema.parse(data)
    return Object.fromEntries(Object.entries(fields).map(([name, items]) => [name, Object.fromEntries(items.map((i) => [i.value, i.count]))]))
}
