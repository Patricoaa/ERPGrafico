"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import type { DocumentRef } from "../types"

type OpenableRef = Pick<DocumentRef, "label" | "id" | "display_id"> & { url?: string | null }

/**
 * Abre un documento relacionado: su ficha registrada con `openEntity` (apila y permite volver);
 * sin ficha registrada → navega a su URL canónica (ADR-0080).
 */
export function useOpenRelatedDocument() {
    const router = useRouter()
    const { openEntity } = useGlobalModals()
    return useCallback((ref: OpenableRef) => {
        if (hasEntityDrawer(ref.label)) {
            openEntity(ref.label, ref.id, undefined, undefined, { display: ref.display_id })
            return
        }
        if (ref.url) router.push(ref.url)
    }, [openEntity, router])
}
