"use client"

import * as React from "react"
import { useViewMode } from "@/hooks/useViewMode"
import type { EntityLabel } from "@/lib/entity-registry"
import type { CollectionViewMode } from "./Collection"

/**
 * URL parity for the collection view (ADR-0087 lote 1): the same `?view=` param and saved
 * preference as `useViewMode`, translated to entity-view modes (`list` ↔ `table`, `card` ↔ `card`).
 * Pass the result to `<Collection.Root view onViewChange>`.
 */
export function useCollectionViewMode(label: EntityLabel, defaultView?: CollectionViewMode) {
    // Without an explicit default, `useViewMode` falls back to the registry's `viewPolicy.defaultView`.
    const { currentView, handleViewChange } = useViewMode(label, defaultView && (defaultView === "table" ? "list" : "card"))
    // Legacy card-like views ("card", "grid") render as cards; any other view as the table.
    const view: CollectionViewMode = currentView === "card" || currentView === "grid" ? "card" : "table"
    const onViewChange = React.useCallback(
        (next: CollectionViewMode) => handleViewChange(next === "table" ? "list" : "card"),
        [handleViewChange],
    )
    return { view, onViewChange }
}
