"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { useOpenDocument } from "@/hooks/useOpenDocument"
import { documentRefTarget } from "@/lib/documentNavigation"
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
 * La regla (apilar con «volver» o navegar a la lista canónica) vive en `useOpenDocument`
 * (ADR-0086 / ADR-0100, según el flag del drill-down).
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
    const openDocument = useOpenDocument()

    const target = documentRefTarget(documentRef)
        ?? (label && id != null && display ? { label, id, display, url: url ?? null } : null)
    if (!target) return null

    const onClick = (e: React.MouseEvent) => {
        // Vive dentro de filas/tarjetas clicables: no debe disparar también su selección.
        e.stopPropagation()
        openDocument({ label: target.label, id: target.id, display: target.display, url: target.url })
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
