import { type DocumentRelationsFilters } from "../types"

/**
 * Query keys del modelo documental común.
 *   all            → ['documents']
 *   ref(l, id)     → ['documents', 'ref', label, id]
 *   relations(...) → ['documents', 'relations', label, id, { filters }]
 */
export const DOCUMENTS_KEYS = {
    all: ["documents"] as const,
    ref: (label: string, id: number) => [...DOCUMENTS_KEYS.all, "ref", label, id] as const,
    relations: (label: string, id: number, filters?: DocumentRelationsFilters) =>
        [...DOCUMENTS_KEYS.all, "relations", label, id, { filters }] as const,
}
