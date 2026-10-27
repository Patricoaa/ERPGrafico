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

/** Registro recién guardado desde una pestaña (ADR-0101): `id` null = creación (id aún desconocido). */
export interface SavedRecord {
    label: string
    id: number | null
    /** Marca del guardado: cada guardado es una señal nueva aunque repita registro. */
    at: number
}

/**
 * Último guardado y entidades con un panel de creación abierto. La colección de esa entidad resalta la
 * fila guardada; en una creación, la fila que no estaba cuando se abrió el panel.
 */
export interface RecentSave {
    saved: SavedRecord | null
    creating: readonly string[]
}

const RecentSaveContext = React.createContext<RecentSave>({ saved: null, creating: [] })

export function RecentSaveProvider({ value, children }: { value: RecentSave; children: React.ReactNode }) {
    return <RecentSaveContext.Provider value={value}>{children}</RecentSaveContext.Provider>
}

export function useRecentSave(): RecentSave {
    return React.useContext(RecentSaveContext)
}
