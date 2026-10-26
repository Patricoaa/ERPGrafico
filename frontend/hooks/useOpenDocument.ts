"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { isDrilldownStackEnabled, isListSelectionUrl } from "@/lib/documentNavigation"

export interface OpenDocumentRef {
    /** Label `app.model` del documento. */
    label: string
    id: number
    /** Texto del «Volver a …» de lo que se abra encima. */
    display?: string
    /** URL canónica del destino (`DocumentRef.url`). */
    url?: string | null
    /** Datos ya cargados; solo los usa el modo heredado (ADR-0086). */
    data?: unknown
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
 * registrada, o (modo heredado) de una URL de lista con `?selected=`. Si no, la superficie puede
 * pintar un `<Link href>` normal (clic con cmd/ctrl, nueva pestaña…).
 */
export function opensInApp(ref: Pick<OpenDocumentRef, "label" | "url">): boolean {
    if (hasEntityDrawer(ref.label)) return true
    return !isDrilldownStackEnabled() && isListSelectionUrl(ref.url)
}

/**
 * Punto único del drill-down documental. Toda superficie que abre «otro documento» pasa por aquí.
 *
 * - Flag `drilldownStack` activo (ADR-0100): apila la ficha sobre la lista de origen (`openEntity`);
 *   el módulo y la URL no cambian. Sin ficha registrada cae a `router.push(url)`.
 * - Flag inactivo (ADR-0086, comportamiento heredado): si la URL canónica es una lista con
 *   `?selected=`, navega; si no, apila.
 *
 * La URL canónica sigue siendo la vía de enlaces externos, búsqueda universal y `/d/{label}/{id}`.
 */
export function useOpenDocument() {
    const router = useRouter()
    const { openEntity } = useGlobalModals()

    return useCallback((ref: OpenDocumentRef) => {
        const url = ref.url ?? null

        if (isDrilldownStackEnabled()) {
            if (hasEntityDrawer(ref.label)) {
                openEntity(ref.label, ref.id, undefined, undefined, { display: ref.display })
            } else if (url && url !== "#") {
                router.push(url)
            }
            return
        }

        if (isListSelectionUrl(url)) {
            router.push(url as string, { scroll: false })
            return
        }
        if (hasEntityDrawer(ref.label)) {
            openEntity(ref.label, ref.id, ref.data, undefined, { display: ref.display })
            return
        }
        if (url && url !== "#") router.push(url)
    }, [openEntity, router])
}
