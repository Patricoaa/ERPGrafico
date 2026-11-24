"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn, formatDateWith } from "@/lib/utils"
import { useNow } from "../../hooks/useNow"
import { POSTopBar } from "./POSTopBar"
import { fadeInClass } from "@/components/shared"

/** Margen tras abrir el salvapantallas en el que el movimiento del mouse no lo cierra. */
const WAKE_GRACE_MS = 1000

const pad = (n: number) => String(n).padStart(2, "0")

/** Hora "HH:mm" en vivo, para subtítulos (se refresca cada 15 s). */
export function POSLiveTime({ className }: { className?: string }) {
    const now = useNow(15_000)
    return (
        <time dateTime={now.toISOString()} className={cn("font-mono tabular-nums", className)}>
            {pad(now.getHours())}:{pad(now.getMinutes())}
        </time>
    )
}

interface POSIdleScreenProps {
    open: boolean
    /** Misma identidad que la barra superior del POS. */
    title: string
    subtitle?: ReactNode
    /** Línea inferior bajo el reloj (operador, estado de la sesión…). */
    detail?: ReactNode
    onWake: () => void
}

/**
 * Protector de pantalla del POS por inactividad. Comparte barra superior y composición con los
 * flujos de apertura y cierre de caja (`POSFlowLayout`) y muestra fecha y hora en vivo.
 * Cualquier toque, tecla o movimiento lo cierra.
 */
export function POSIdleScreen({ open, title, subtitle, detail, onWake }: POSIdleScreenProps) {
    const now = useNow(1000)
    const openedAt = useRef(0)
    useEffect(() => {
        if (open) openedAt.current = Date.now()
    }, [open])
    if (!open) return null

    // Mover el mouse también despierta, salvo el instante posterior a abrirse (el cursor aún se mueve).
    const wakeOnMove = () => {
        if (Date.now() - openedAt.current > WAKE_GRACE_MS) onWake()
    }

    const date = formatDateWith(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Protector de pantalla"
            className={cn("fixed inset-0 z-[100] flex cursor-pointer flex-col bg-background text-foreground", fadeInClass({ duration: 500 }))}
            onPointerDown={onWake}
            onPointerMove={wakeOnMove}
            onKeyDown={onWake}
            tabIndex={0}
            ref={el => el?.focus()}
        >
            <POSTopBar title={title} subtitle={subtitle} />

            <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-xl capitalize text-muted-foreground lg:text-2xl">{date}</p>
                <p
                    className="font-mono font-bold leading-none tracking-tighter tabular-nums text-8xl sm:text-9xl lg:text-[10rem]"
                    aria-live="off"
                >
                    {pad(now.getHours())}
                    <span className="animate-pulse motion-reduce:animate-none">:</span>
                    {pad(now.getMinutes())}
                    <span className="text-muted-foreground">:{pad(now.getSeconds())}</span>
                </p>
                {detail && <div className="mt-4 text-lg text-muted-foreground">{detail}</div>}
            </main>

            <footer className="shrink-0 border-t border-border bg-card px-6 py-5 text-center text-lg text-muted-foreground">
                Toque la pantalla para continuar
            </footer>
        </div>
    )
}
