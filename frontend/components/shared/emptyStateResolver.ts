import type React from "react"
import type { LucideIcon } from "lucide-react"
import type { EmptyStateContext } from "./EmptyState"

/** Copy/visuals for a single empty-state scenario. */
export type EmptyStateCopy = {
    title?: string
    description?: string
    icon?: LucideIcon
    action?: React.ReactNode
    context?: EmptyStateContext
}

/**
 * Empty-state configuration shared by every list surface (table + card views).
 * Flat fields describe the "no records at all" case (entity truly empty); the
 * optional `filtered` sub-object overrides the "active search/filter returned
 * nothing" case, with sensible defaults applied when omitted.
 */
export type DataTableEmptyState = EmptyStateCopy & {
    filtered?: EmptyStateCopy
}

export type ResolvedEmptyState = {
    context: EmptyStateContext
    title?: string
    description?: string
    icon?: LucideIcon
    action?: React.ReactNode
}

/**
 * Resolves which empty-state copy to render. Single source of truth for the
 * "no records" vs "no search results" decision so every variant
 * (table embedded / minimal / standalone and card grids) stays consistent.
 *
 * - `isFiltered === true`  → filtered ("No se encontraron resultados")
 * - `isFiltered === false` → entity-specific "sin registros"
 * - `isFiltered === undefined` → legacy single empty-state (back-compat)
 */
export function resolveEmptyState(
    emptyState: DataTableEmptyState | undefined,
    isFiltered: boolean | undefined,
): ResolvedEmptyState {
    // Active search/filter returned nothing.
    if (isFiltered === true) {
        const f = emptyState?.filtered
        return {
            context: f?.context ?? "search",
            icon: f?.icon,
            title: f?.title ?? "No se encontraron resultados",
            description: f?.description ?? "Ajusta o limpia los filtros de búsqueda para ver más resultados.",
            action: f?.action,
        }
    }
    // Explicit "no records at all" → entity-specific copy (context drives icon/title).
    if (isFiltered === false) {
        return {
            context: emptyState?.context ?? "generic",
            icon: emptyState?.icon,
            title: emptyState?.title,
            description: emptyState?.description,
            action: emptyState?.action,
        }
    }
    // Legacy (signal not provided): preserve the prior single empty-state.
    return {
        context: emptyState?.context ?? "search",
        icon: emptyState?.icon,
        title: emptyState?.title ?? "No se encontraron resultados",
        description: emptyState?.description ?? "Intenta ajustar los filtros de búsqueda para encontrar lo que buscas.",
        action: emptyState?.action,
    }
}
