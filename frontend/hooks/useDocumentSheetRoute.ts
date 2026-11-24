"use client"

import { useCallback } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"

/**
 * Lista de documentos ↔ pestañas de documento (ADR-0152, sustituye a ADR-0083/0101 §6).
 *
 * - `toggle(id, fila?)` abre el documento en **su propia pestaña** (`openEntity`): cada fila suma una pestaña y
 *   volver a elegir una ya abierta la activa. La fila sirve de `data` para el título (`OV-123`).
 * - `?selected={id}` es solo enlace profundo (`useDeepLinkEntity`): abre la pestaña una vez y limpia la URL.
 * - `selectedId` es el documento de la pestaña activa de este `label` (resalta su fila); `isOpen` indica
 *   que esa pestaña está activa.
 * - `label = null` desactiva todo (listas incrustadas con su propia selección, p. ej. el POS).
 */
export function useDocumentSheetRoute(label: string | null) {
    const { openEntity, activeEntity } = useGlobalModals()
    useDeepLinkEntity(label)

    const selectedId = label && activeEntity?.label === label ? activeEntity.id : null

    const toggle = useCallback((id: number, data?: unknown) => {
        if (label) openEntity(label, id, data)
    }, [label, openEntity])

    return { selectedId, isOpen: selectedId !== null, toggle }
}
