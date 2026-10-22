"use client"

import { registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import "./docRef"
import { DocumentRefLink } from "../components/DocumentRefLink"

function DocRefCell({ value, options }: ValueRenderProps<"docRef">) {
    if (!value) {
        // A fallback is a real value without a sheet (e.g. a line typed by hand): plain text, not the empty glyph.
        return options.fallback
            ? <span className="text-xs font-medium">{options.fallback}</span>
            : <span className="text-xs text-muted-foreground">—</span>
    }
    return <DocumentRefLink label={value.label} id={value.id} display={value.display} url={value.url ?? null} mono={false} />
}

let registered = false

/** Idempotent. Runs when this module is evaluated; stories may call it directly. */
export function registerDocumentValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("docRef", {
        format: (v, o) => v?.display ?? o.fallback ?? "—",
        sortValue: (v, o) => v?.display ?? o.fallback ?? null,
        render: DocRefCell,
    })
}

// Registered when the documents barrel is evaluated (the only way to reach the `docRef` builder).
registerDocumentValueKinds()
