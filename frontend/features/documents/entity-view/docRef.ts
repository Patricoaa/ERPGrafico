import type { Accessor, FieldBuilders, FieldDef, FieldMeta, RowAware } from "@/components/entity-view"

/** Minimal reference: a full `DocumentRef` (ADR-0080) or label + id + display. */
export interface DocRefValue {
    label: string
    id: number
    display: string
    url?: string | null
}

/**
 * Feature extension (ADR-0087 §2): "reference to a document" lives here because
 * DocumentRefLink belongs to features/documents and shared cannot import it (FSD, invariant #3).
 * Covers category A of the computed audit (20 of 51).
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        docRef: { value: DocRefValue | null; options: { fallback?: string } }
    }
}

/**
 * Field builder of the extension. It has **no runtime imports** and is the first export of the
 * `@/features/documents` barrel: entity definitions evaluated inside an import cycle that passes
 * through the barrel (lote 3a) still find it initialized. The kind itself is registered by
 * `docRef.kind.tsx`, which the same barrel evaluates, so a `docRef` field is always renderable.
 */
export function docRef<T>(f: FieldBuilders<T>, accessor: Accessor<T, DocRefValue | null>, input: FieldMeta & RowAware<{ fallback?: string }, T>): FieldDef<T, "docRef"> {
    return f.value("docRef", accessor, input)
}
