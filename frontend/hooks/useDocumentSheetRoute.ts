"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

/**
 * `?selected={id}` de una lista de documentos ↔ pestaña del documento (ADR-0020 + ADR-0083 + ADR-0101).
 *
 * - Al cambiar `?selected` abre la pestaña de `label` y cierra la de la selección anterior (la fila
 *   que se explora ocupa una sola pestaña; lo que se abre desde un documento suma pestañas).
 * - Quitar `?selected` cierra esa pestaña; cerrar la pestaña limpia `?selected`.
 * - `label = null` desactiva la apertura (p. ej. listas incrustadas con su propio panel).
 *
 * `toggle(id)` alterna la selección de una fila; `selectedId` sirve para resaltarla.
 */
export function useDocumentSheetRoute(label: string | null) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const selectedId = Number(searchParams.get("selected")) || null
    const { openRootEntity, closeEntityByRef, isEntityOpen, runGuarded } = useGlobalModals()
    const isOpen = !!label && !!selectedId && isEntityOpen(label, selectedId)

    const openedIdRef = useRef<number | null>(null)
    const wasOpenRef = useRef(false)

    const setSelected = useCallback((id: number | null, replace = false) => {
        const params = new URLSearchParams(searchParams.toString())
        if (id) params.set("selected", String(id))
        else params.delete("selected")
        const query = params.toString()
        const url = query ? `${pathname}?${query}` : pathname
        if (replace) router.replace(url, { scroll: false })
        else router.push(url, { scroll: false })
    }, [searchParams, pathname, router])

    useEffect(() => {
        if (!label) return
        const previousId = openedIdRef.current
        if (previousId === selectedId) return
        openedIdRef.current = selectedId
        wasOpenRef.current = false
        if (previousId) closeEntityByRef(label, previousId)
        if (selectedId) openRootEntity(label, selectedId)
    }, [label, selectedId, openRootEntity, closeEntityByRef])

    // Cerrar la pestaña de la selección (X, "cerrar pestaña") limpia `?selected`.
    useEffect(() => {
        if (!label || !openedIdRef.current) return
        if (isOpen) {
            wasOpenRef.current = true
            return
        }
        if (!wasOpenRef.current) return
        wasOpenRef.current = false
        openedIdRef.current = null
        setSelected(null, true)
    }, [label, isOpen, setSelected])

    // La guarda de cambios sin guardar va antes de tocar la URL: el efecto de arriba ya no puede esperar un diálogo.
    const toggle = useCallback((id: number) => {
        runGuarded(() => setSelected(selectedId === id && isOpen ? null : id))
    }, [selectedId, isOpen, setSelected, runGuarded])

    return { selectedId, isOpen: !!selectedId && isOpen, toggle }
}
