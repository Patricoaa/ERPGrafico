"use client"

import * as React from "react"
import type { EntityLabel } from "@/lib/entity-registry"

/**
 * Bootstrap point of the entity-view system (ADR-0087 §1, §4). Lives in the shell layer and depends
 * only on React, so `GlobalModalProvider` can mount it without importing the entity-view barrel
 * (no import cycle with `@/components/shared`, nothing extra in the root bundle). Public API via
 * `@/components/entity-view`.
 * - `open`: default action for a row (in the app: `openEntity` of GlobalModalProvider → drawer registry, ADR-0028).
 * - `labelOf`: accessible name of a collection from its registry label.
 *
 * Mounted once by `GlobalModalProvider` (through `EntityViewBridge`); stories mount it with a mock.
 */
export interface EntityOpener {
    open: (label: EntityLabel, id: number, row: unknown) => void
    labelOf: (label: EntityLabel) => string | undefined
}

const EntityOpenerContext = React.createContext<EntityOpener | null>(null)

export function EntityViewProvider({ opener, children }: { opener: EntityOpener; children: React.ReactNode }) {
    return <EntityOpenerContext.Provider value={opener}>{children}</EntityOpenerContext.Provider>
}

export function useEntityOpener(): EntityOpener | null {
    return React.useContext(EntityOpenerContext)
}
