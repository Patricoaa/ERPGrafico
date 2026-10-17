"use client"

import * as React from "react"

/**
 * Bootstrap point of the entity-view system (ADR-0087 §1, §4):
 * - `open`: default action for a row (in the app: `openEntity` of GlobalModalProvider → drawer registry, ADR-0028).
 * - `labelOf`: accessible name of a collection from its registry label.
 *
 * Mounted once in the app shell; stories mount it with a mock. Feature value kinds are
 * registered by importing each feature's registration module next to this provider.
 */
export interface EntityOpener {
    open: (label: string, id: number, row: unknown) => void
    labelOf: (label: string) => string | undefined
}

const EntityOpenerContext = React.createContext<EntityOpener | null>(null)

export function EntityViewProvider({ opener, children }: { opener: EntityOpener; children: React.ReactNode }) {
    return <EntityOpenerContext.Provider value={opener}>{children}</EntityOpenerContext.Provider>
}

export function useEntityOpener(): EntityOpener | null {
    return React.useContext(EntityOpenerContext)
}
