"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"

export interface OpenDocumentRef {
    /** Label `app.model` del documento. */
    label: string
    id: number
    /** Título de la pestaña mientras la ficha no conoce su número. */
    display?: string
    /** URL canónica del destino (`DocumentRef.url`). */
    url?: string | null
}

/**
 * ¿Se puede abrir el documento desde la app (hay ficha registrada o una URL a la que ir)?
 * Las superficies lo usan para decidir si pintan un enlace interactivo o texto plano.
 */
export function canOpenDocument(ref: Pick<OpenDocumentRef, "label" | "url">): boolean {
    if (hasEntityDrawer(ref.label)) return true
    return typeof ref.url === "string" && ref.url !== "" && ref.url !== "#"
}

/**
 * ¿El clic abre el documento dentro de la app sin una navegación nativa? Es el caso de una ficha
 * registrada. Si no, la superficie puede pintar un `<Link href>` normal (clic con cmd/ctrl, nueva pestaña…).
 */
export function opensInApp(ref: Pick<OpenDocumentRef, "label" | "url">): boolean {
    return hasEntityDrawer(ref.label)
}

/**
 * Punto único del drill-down documental (ADR-0100 / ADR-0101). Toda superficie que abre «otro
 * documento» pasa por aquí: abre la ficha como pestaña del espacio de trabajo; el módulo y la URL no
 * cambian. Sin ficha registrada cae a `router.push(url)`.
 *
 * La URL canónica sigue siendo la vía de enlaces externos, búsqueda universal y `/d/{label}/{id}`.
 */
export function useOpenDocument() {
    const router = useRouter()
    const { openEntity } = useGlobalModals()

    return useCallback((ref: OpenDocumentRef) => {
        if (hasEntityDrawer(ref.label)) {
            openEntity(ref.label, ref.id, undefined, undefined, { display: ref.display })
        } else if (ref.url && ref.url !== "#") {
            router.push(ref.url)
        }
    }, [openEntity, router])
}
