"use client"

import { registerValueKind, type Accessor, type FieldBuilders, type FieldDef, type FieldMeta, type ValueRenderProps } from "@/components/entity-view"
import { DocumentRefLink } from "../components/DocumentRefLink"

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

function DocRefCell({ value, options }: ValueRenderProps<"docRef">) {
    if (!value) {
        return <span className="text-xs text-muted-foreground">{options.fallback ?? "—"}</span>
    }
    return <DocumentRefLink label={value.label} id={value.id} display={value.display} url={value.url ?? null} mono={false} />
}

let registered = false

/** Called once from the app bootstrap (next to EntityViewProvider) and from stories. */
export function registerDocumentValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("docRef", {
        format: (v, o) => v?.display ?? o.fallback ?? "—",
        sortValue: (v, o) => v?.display ?? o.fallback ?? null,
        render: DocRefCell,
    })
}

/**
 * Field builder of the extension (adjustment from the onboarding test, 05 §6): using it registers
 * the kind, so an entity can never declare a `docRef` field that fails at runtime for lack of
 * a bootstrap call. To be exported from the `@/features/documents` barrel on adoption (invariant #3).
 */
export function docRef<T>(f: FieldBuilders<T>, accessor: Accessor<T, DocRefValue | null>, input: FieldMeta & { fallback?: string }): FieldDef<T, "docRef"> {
    registerDocumentValueKinds()
    return f.value("docRef", accessor, input)
}
