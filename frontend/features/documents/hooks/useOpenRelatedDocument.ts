"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { isListSelectionUrl } from "@/lib/documentNavigation"
import type { DocumentRef } from "../types"

type OpenableRef = Pick<DocumentRef, "label" | "id" | "display_id"> & { url?: string | null }

/**
 * Abre un documento relacionado (ADR-0086):
 *
 * - Si su URL canónica abre una lista real (`?selected={id}`), **navega** allí: cambian
 *   la URL y el módulo/sección, y la lista destino abre la ficha (ADR-0020/0083).
 * - Si no (resolvedor `/d/{label}/{id}` o sin lista con `?selected`), apila en memoria
 *   con "volver" vía `openEntity` (ADR-0028). Los maestros (contacto, producto…) caen aquí.
 */
export function useOpenRelatedDocument() {
    const router = useRouter()
    const { openEntity } = useGlobalModals()
    return useCallback((ref: OpenableRef) => {
        if (isListSelectionUrl(ref.url)) {
            router.push(ref.url as string, { scroll: false })
            return
        }
        if (hasEntityDrawer(ref.label)) {
            openEntity(ref.label, ref.id, undefined, undefined, { display: ref.display_id })
            return
        }
        if (ref.url) router.push(ref.url)
    }, [openEntity, router])
}
