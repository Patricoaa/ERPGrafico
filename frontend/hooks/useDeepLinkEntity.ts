"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"

export interface UseDeepLinkEntityOptions {
    /** Query param con el id del registro. Default `selected`. */
    selectedParam?: string
    /**
     * Valores de `?action` que esta entidad atiende; `null` = sin `?action`. Sin lista, cualquier acción.
     * Lo que no coincide se deja en la URL para otro panel de la misma página.
     */
    actions?: readonly (string | null)[]
}

/**
 * `?selected=<id>` como enlace profundo (ADR-0152): al cargar la página abre **una vez** la pestaña del
 * registro (`openEntity`) y limpia el parámetro. La URL no refleja las pestañas abiertas; abrir otra
 * fila no pasa por aquí sino por `openEntity` (clic de fila de la colección).
 *
 * No hace nada si la entidad no está en `ENTITY_DRAWERS` (deja la URL intacta para el drawer de la
 * página) ni fuera del `GlobalModalProvider`.
 */
export function useDeepLinkEntity(label: string, { selectedParam = "selected", actions }: UseDeepLinkEntityOptions = {}): void {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const openEntity = useOptionalGlobalModalActions()?.openEntity
    const handled = useRef<string | null>(null)

    const raw = searchParams.get(selectedParam)
    const action = searchParams.get("action")
    const id = Number(raw) || null
    const applies = id !== null && (!actions || actions.includes(action))

    useEffect(() => {
        if (!applies || id === null || !openEntity || !hasEntityDrawer(label)) return
        const signature = `${label}:${id}:${action ?? ""}`
        if (handled.current === signature) return
        handled.current = signature

        openEntity(label, id)
        const params = new URLSearchParams(searchParams.toString())
        params.delete(selectedParam)
        if (selectedParam === "selected") params.delete("action")
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [applies, id, action, label, openEntity, searchParams, selectedParam, router, pathname])
}
