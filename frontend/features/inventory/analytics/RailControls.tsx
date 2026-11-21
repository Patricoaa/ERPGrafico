"use client"

import {
    createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react"
import { createPortal } from "react-dom"

interface RailControlsContextValue {
    slots: HTMLElement[]
    registerSlot: (element: HTMLElement) => () => void
    mountControls: () => () => void
    controlsCount: number
}

const RailControlsContext = createContext<RailControlsContextValue | null>(null)

/** Conecta los controles de un bloque con las zonas Vista del riel (y su copia móvil). */
export function RailControlsProvider({ children }: { children: ReactNode }) {
    const [slots, setSlots] = useState<HTMLElement[]>([])
    const [controlsCount, setControlsCount] = useState(0)

    const registerSlot = useCallback((element: HTMLElement) => {
        setSlots((current) => (current.includes(element) ? current : [...current, element]))
        return () => setSlots((current) => current.filter((e) => e !== element))
    }, [])
    const mountControls = useCallback(() => {
        setControlsCount((n) => n + 1)
        return () => setControlsCount((n) => n - 1)
    }, [])

    const value = useMemo(
        () => ({ slots, registerSlot, mountControls, controlsCount }),
        [slots, registerSlot, mountControls, controlsCount],
    )
    return <RailControlsContext.Provider value={value}>{children}</RailControlsContext.Provider>
}

/** Zona Vista: destino de los controles del tab activo. Se puede montar más de una (riel y móvil). */
export function ViewControlsSlot() {
    const ctx = useContext(RailControlsContext)
    const [element, setElement] = useState<HTMLDivElement | null>(null)
    const register = ctx?.registerSlot

    useEffect(() => (element && register ? register(element) : undefined), [element, register])

    if (!ctx) return null
    return (
        <div className="px-3 py-2">
            {ctx.controlsCount > 0 && (
                <p className="mb-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Vista</p>
            )}
            <div ref={setElement} role="group" aria-label="Controles de vista" className="flex flex-col gap-3" />
        </div>
    )
}

/** Entrega sus hijos a la zona Vista; sin proveedor o sin zonas registradas los muestra en línea. */
export function RailControls({ children }: { children: ReactNode }) {
    const ctx = useContext(RailControlsContext)
    const mount = ctx?.mountControls

    useEffect(() => mount?.(), [mount])

    if (!ctx || ctx.slots.length === 0) return <>{children}</>
    return <>{ctx.slots.map((slot, index) => createPortal(children, slot, String(index)))}</>
}
