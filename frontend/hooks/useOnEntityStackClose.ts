"use client"

import { useEffect, useRef } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

/**
 * Ejecuta `callback` cuando se cierra la pila de fichas de `openEntity` (ADR-0083).
 * Reemplaza el `onActionSuccess` que se pasaba al Order Hub: quien abre una ficha y necesita
 * refrescar sus datos (tareas, deudas, la orden de un asistente) lo hace al volver.
 */
export function useOnEntityStackClose(callback: () => void) {
    const { isSubModalActive } = useGlobalModals()
    const wasOpen = useRef(false)
    const callbackRef = useRef(callback)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    useEffect(() => {
        if (isSubModalActive) {
            wasOpen.current = true
        } else if (wasOpen.current) {
            wasOpen.current = false
            callbackRef.current()
        }
    }, [isSubModalActive])
}
