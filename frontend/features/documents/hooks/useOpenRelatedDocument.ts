"use client"

import { useCallback } from "react"
import { useOpenDocument } from "@/hooks/useOpenDocument"
import type { DocumentRef } from "../types"

type OpenableRef = Pick<DocumentRef, "label" | "id" | "display_id"> & { url?: string | null }

/**
 * Abre un documento relacionado desde las filas del tab Relaciones. La regla (apilar o navegar,
 * según el flag del drill-down) vive en `useOpenDocument` (ADR-0086 / ADR-0100).
 */
export function useOpenRelatedDocument() {
    const openDocument = useOpenDocument()
    return useCallback((ref: OpenableRef) => {
        openDocument({ label: ref.label, id: ref.id, display: ref.display_id, url: ref.url })
    }, [openDocument])
}
