"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

/**
 * `?selected={id}` de una lista de documentos ↔ ficha documental en la pila de `openEntity`
 * (ADR-0020 + ADR-0083). Reemplaza la apertura del Order Hub desde las listas.
 *
 * - Al cambiar `?selected` abre la ficha de `label` (vacía la pila antes: una selección nueva
 *   de la lista reemplaza lo abierto). Lo que se abra desde la ficha se apila con "volver".
 * - Al cerrar la pila se limpia `?selected`; quitar `?selected` cierra la ficha.
 * - `label = null` desactiva la apertura (p. ej. listas incrustadas con su propio panel).
 *
 * `toggle(id)` alterna la selección de una fila; `selectedId` sirve para resaltarla.
 */
export function useDocumentSheetRoute(label: string | null) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const selectedId = Number(searchParams.get("selected")) || null
    const { openEntity, closeEntity, isSubModalActive } = useGlobalModals()

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
        if (!selectedId) {
            if (openedIdRef.current) {
                openedIdRef.current = null
                closeEntity()
            }
            return
        }
        if (openedIdRef.current === selectedId) return
        openedIdRef.current = selectedId
        wasOpenRef.current = false
        closeEntity()
        openEntity(label, selectedId)
    }, [label, selectedId, openEntity, closeEntity])

    useEffect(() => {
        if (!label) return
        if (isSubModalActive) {
            wasOpenRef.current = true
            return
        }
        if (!wasOpenRef.current || !openedIdRef.current) return
        wasOpenRef.current = false
        openedIdRef.current = null
        setSelected(null, true)
    }, [label, isSubModalActive, setSelected])

    const toggle = useCallback((id: number) => {
        setSelected(selectedId === id && isSubModalActive ? null : id)
    }, [selectedId, isSubModalActive, setSelected])

    return { selectedId, isOpen: !!selectedId && isSubModalActive, toggle }
}
