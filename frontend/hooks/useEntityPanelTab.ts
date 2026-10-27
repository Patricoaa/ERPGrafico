"use client"

import { useEffect, useRef } from "react"
import { panelTabKey, useOptionalGlobalModals } from "@/components/providers/GlobalModalProvider"

export interface UseEntityPanelTabOptions {
    /** Clave `app.model` de la entidad (la de `ENTITY_REGISTRY`). */
    label: string
    /** Registro abierto; null = creación. */
    id: number | null
    /** El drawer de la página está abierto (`?selected` resuelto, `?modal=new`…). */
    open: boolean
    /** Distingue dos paneles del mismo registro. */
    variant?: string
    /** Texto de la pestaña; por defecto "{Entidad} #{id}" o "Nuevo {entidad}". */
    display?: string
    /** El usuario cerró la pestaña (×, Delete): cierra el drawer (p. ej. `clearSelection`). */
    onClose: () => void
}

/**
 * Un drawer de entidad montado por la página ocupa una pestaña de la barra de trabajo (ADR-0101).
 *
 * La página sigue renderizando su drawer; este hook registra la pestaña mientras `open` y devuelve si el
 * drawer debe verse: abierto y con su pestaña activa. Al volver a la pestaña de la página o a otra pestaña
 * el drawer se oculta sin perder la selección. Fuera del provider devuelve `open`.
 */
export function useEntityPanelTab({ label, id, variant, open, display, onClose }: UseEntityPanelTabOptions): boolean {
    const modals = useOptionalGlobalModals()
    const registerPanelTab = modals?.registerPanelTab
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose }, [onClose])

    useEffect(() => {
        if (!open || !registerPanelTab) return
        return registerPanelTab({ label, id, variant, display }, () => onCloseRef.current())
    }, [open, registerPanelTab, label, id, variant, display])

    if (!modals) return open
    const active = modals.tabs.some(tab => tab.active && tab.kind === "panel" && tab.key === panelTabKey({ label, id, variant }))
    return open && active
}
