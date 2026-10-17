"use client"

import { createContext, useContext } from "react"

/**
 * Navegación entre documentos abiertos con `openEntity` (ADR-0080, GAP-11).
 * GlobalModalProvider lo provee alrededor del drawer superior de la pila cuando hay
 * un documento anterior; `Drawer` lo lee para mostrar "← Volver a …".
 * Cada `Drawer` lo resetea para sus hijos, así un drawer anidado no muestra el enlace.
 */
export interface EntityNavigation {
    backLabel: string
    goBack: () => void
}

export const EntityNavigationContext = createContext<EntityNavigation | null>(null)

export function useEntityNavigation(): EntityNavigation | null {
    return useContext(EntityNavigationContext)
}
