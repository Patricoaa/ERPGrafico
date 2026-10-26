"use client"

import { useEffect, useState } from "react"
import { isDrilldownStackEnabled } from "@/lib/documentNavigation"
import { isRestorableById } from "@/lib/entity-drawers"
import { STACK_PARAM, decodeStack, encodeStack, type StackRef } from "@/lib/drilldownStackUrl"

/** Lo último que el hook escribió o leyó; solo se modifica dentro de efectos y handlers. */
class StackUrlMirror {
    private everOpen = false
    private length = 0
    pathname = ""

    setPathname(pathname: string) { this.pathname = pathname }

    /**
     * Registra el nuevo tamaño de la pila. `pristine`: la pila nunca ha tenido documentos, así que aún
     * puede estar pendiente de restaurarse desde la URL (también cubre el doble efecto de StrictMode).
     */
    advance(length: number): { grew: boolean; pristine: boolean } {
        const result = { grew: length > this.length, pristine: length === 0 && !this.everOpen }
        this.length = length
        if (length > 0) this.everOpen = true
        return result
    }
}

function urlWithStack(encoded: string): URL {
    const url = new URL(window.location.href)
    if (encoded) url.searchParams.set(STACK_PARAM, encoded)
    else url.searchParams.delete(STACK_PARAM)
    return url
}

const serializable = <T extends StackRef>(stack: readonly T[]) => stack.filter((entry) => isRestorableById(entry.label))

interface UseDrilldownStackUrlOptions<T extends StackRef> {
    stack: readonly T[]
    /** Pila vigente para los handlers (el espejo de GlobalModalProvider). */
    live: { stack: readonly T[] }
    setStack: (next: T[]) => void
    runGuarded: (action: () => void, onCancel?: () => void) => void
    pathname: string
    toEntry: (ref: StackRef) => T
}

/**
 * La pila de documentos viaja en `?stack=` (ADR-0100 fase 5, tras el flag del drill-down):
 * - abrir un documento añade una entrada de historial (Atrás desapila, Adelante reapila);
 * - desapilar o cerrar reemplaza la entrada actual;
 * - recargar o abrir un enlace con `?stack=` reconstruye la pila cargando cada documento por id;
 * - Atrás/Adelante con cambios sin guardar pasan por la guarda; si se cancela, se restaura la URL.
 *
 * Solo viajan los documentos que se abren por id (`isRestorableById`); el resto vive en memoria.
 * Usa la History API nativa: Next sincroniza `usePathname`/`useSearchParams` con ella y no hace falta
 * `useSearchParams` (que exigiría un Suspense en el layout raíz).
 */
export function useDrilldownStackUrl<T extends StackRef>({ stack, live, setStack, runGuarded, pathname, toEntry }: UseDrilldownStackUrlOptions<T>): void {
    const [mirror] = useState(() => new StackUrlMirror())

    // Restauración inicial y Atrás/Adelante. Declarado antes que el espejo: en el montaje debe leer la URL primero.
    useEffect(() => {
        mirror.setPathname(pathname)
        if (!isDrilldownStackEnabled()) return

        const apply = () => {
            if (!isDrilldownStackEnabled() || window.location.pathname !== mirror.pathname) return
            const refs = decodeStack(new URLSearchParams(window.location.search).get(STACK_PARAM))
                .filter((ref) => isRestorableById(ref.label))
            const current = live.stack
            const currentEncoded = encodeStack(serializable(current))
            if (encodeStack(refs) === currentEncoded) return
            const target = refs.length >= 2
                ? refs.map((ref) => current.find((e) => e.label === ref.label && e.id === ref.id) ?? toEntry(ref))
                : current.slice(0, 1)
            runGuarded(
                () => setStack([...target]),
                () => window.history.pushState(null, "", urlWithStack(currentEncoded)),
            )
        }

        apply()
        window.addEventListener("popstate", apply)
        return () => window.removeEventListener("popstate", apply)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `apply` lee el espejo vigente; solo cambia el pathname
    }, [pathname])

    // Pila → URL.
    useEffect(() => {
        if (!isDrilldownStackEnabled()) return
        const { grew, pristine } = mirror.advance(stack.length)
        // Aún no se ha restaurado la pila de la URL; borrarla aquí la perdería.
        if (pristine) return
        const next = encodeStack(serializable(stack))
        const current = new URLSearchParams(window.location.search).get(STACK_PARAM) ?? ""
        if (next === current) return
        window.history[grew ? "pushState" : "replaceState"](null, "", urlWithStack(next))
    }, [stack, mirror])
}
