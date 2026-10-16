"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { documentRefTarget, isListSelectionUrl } from "@/lib/documentNavigation"
import { cn } from "@/lib/utils"

/**
 * Enlace a la ficha de otro documento o entidad (ADR-0083).
 * `mono` para códigos de documento; texto normal para nombres (producto, contacto).
 *
 * Dos formas de uso:
 * - `documentRef={l.stock_move_document}` — el `DocumentRef` del backend (ADR-0080); de ahí salen
 *   label/id/display/url. Es la forma preferida: el `url` viaja siempre.
 * - `label`/`id`/`display` (+ `url` opcional) — cuando no hay un DocumentRef a mano.
 *
 * Si la `url` canónica abre una lista (`?selected={id}`), navega allí para que la URL y el
 * módulo/sección sigan a la relación (ADR-0086); si no, apila con "volver".
 */
export function DocumentRefLink({ documentRef, label, id, display, url, mono = true, className }: {
    /** DocumentRef del backend (payload `Record<string, unknown>`). ADR-0080/0086. */
    documentRef?: unknown
    label?: string
    id?: number
    display?: string
    /** URL canónica del destino (DocumentRef.url). ADR-0086. */
    url?: string | null
    mono?: boolean
    className?: string
}) {
    const { openEntity } = useGlobalModals()
    const router = useRouter()

    const target = documentRefTarget(documentRef)
        ?? (label && id != null && display ? { label, id, display, url: url ?? null } : null)
    if (!target) return null

    const onClick = () => {
        if (isListSelectionUrl(target.url)) {
            router.push(target.url as string, { scroll: false })
            return
        }
        openEntity(target.label, target.id, undefined, undefined, { display: target.display })
    }

    return (
        <Button
            variant="link"
            size="sm"
            className={cn("h-auto p-0 text-left text-xs font-medium whitespace-normal", mono && "font-mono", className)}
            onClick={onClick}
        >
            {target.display}
        </Button>
    )
}
