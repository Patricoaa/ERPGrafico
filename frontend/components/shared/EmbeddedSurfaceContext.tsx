"use client"

import * as React from "react"

/**
 * Marks a subtree as an overlay surface (modal or drawer). `Collection.View` reads it to default to the
 * embedded variant (no frame, columns-only empty state, "Mostrar más"), ADR-0137.
 */
const EmbeddedSurfaceContext = React.createContext(false)

export function EmbeddedSurfaceProvider({ children }: { children: React.ReactNode }) {
    return <EmbeddedSurfaceContext.Provider value>{children}</EmbeddedSurfaceContext.Provider>
}

/** True inside a `BaseModal` or `Drawer`. */
export function useEmbeddedSurface(): boolean {
    return React.useContext(EmbeddedSurfaceContext)
}
