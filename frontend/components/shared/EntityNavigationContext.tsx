"use client"

import { createContext, useContext } from "react"
import type { LucideIcon } from "lucide-react"

/** Documento anterior de la pila, al que se puede volver con un clic en las migas. */
export interface EntityTrailItem {
    key: string
    label: string
    /** Desapila hasta este documento (pasa por la guarda de cambios sin guardar). */
    onSelect: () => void
}

/**
 * Navegación entre documentos abiertos con `openEntity` (ADR-0080, GAP-11; migas en ADR-0100).
 * GlobalModalProvider lo provee alrededor del drawer superior de la pila cuando hay
 * un documento anterior; `Drawer` lo lee para mostrar las migas / "← Volver a …".
 * Cada `Drawer` lo resetea para sus hijos, así un drawer anidado no muestra el enlace.
 */
export interface EntityNavigation {
    backLabel: string
    goBack: () => void
    /** Documentos anteriores, del más antiguo al más reciente. */
    trail: EntityTrailItem[]
    /** Nombre del documento abierto (último tramo de las migas, no interactivo). */
    currentLabel: string
    /**
     * Módulo del documento abierto. Solo viene cuando difiere del módulo de la página (el riel no
     * sigue al drill-down, ADR-0100) para que el usuario sepa dónde "vive" lo que está viendo.
     */
    module: { id: string; label: string; icon: LucideIcon } | null
}

export const EntityNavigationContext = createContext<EntityNavigation | null>(null)

export function useEntityNavigation(): EntityNavigation | null {
    return useContext(EntityNavigationContext)
}
