/**
 * documentNavigation — ADR-0086.
 *
 * Predicate for the document-drilldown rule: a canonical URL is "list selection"
 * when it opens the document from a real list (`?selected={id}`), which means the
 * drilldown should navigate there (module + URL follow the relationship) instead of
 * stacking an in-memory drawer.
 *
 * The route itself is never derived here — it comes from the backend registry
 * (`DocumentRef.url`, ADR-0080 §6). Masters and resolver types (`/d/{label}/{id}`)
 * are left to `openEntity` (ADR-0028).
 */
export function isListSelectionUrl(url: string | null | undefined): boolean {
    return typeof url === "string" && url.includes("?selected=")
}

export interface DocumentRefTarget {
    label: string
    id: number
    display: string
    url: string | null
}

/**
 * Normalizes a `DocumentRef`-shaped payload (`Record<string, unknown>` from a serializer's
 * `*_document` method field) into the props `DocumentRefLink` needs. Returns null when the
 * value is not a usable DocumentRef. ADR-0086.
 */
export function documentRefTarget(ref: unknown): DocumentRefTarget | null {
    if (!ref || typeof ref !== "object") return null
    const r = ref as Record<string, unknown>
    const label = typeof r.label === "string" ? r.label : null
    const id = typeof r.id === "number" ? r.id : null
    const display =
        typeof r.display_id === "string" ? r.display_id
        : typeof r.display === "string" ? r.display
        : null
    if (!label || id == null || !display) return null
    return { label, id, display, url: typeof r.url === "string" ? r.url : null }
}
