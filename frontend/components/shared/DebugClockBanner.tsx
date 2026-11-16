"use client"

import { Clock } from "lucide-react"
import { useServerDate } from "@/hooks/useServerDate"
import { formatDebugClock } from "@/lib/debug-clock"

/**
 * Barra fija superior que avisa que el reloj del servidor está alterado (ADR-0139 D4).
 * Solo se renderiza con `debug_clock` verdadero; no desplaza el layout.
 */
export function DebugClockBanner() {
    const { debugClock, datetime, timezone } = useServerDate()
    if (!debugClock || !datetime) return null

    return (
        <div
            role="status"
            className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex h-5 items-center justify-center gap-1.5 bg-warning text-warning-foreground text-2xs font-semibold tabular-nums"
        >
            <Clock className="h-3 w-3" aria-hidden />
            <span>{`Reloj de depuración: ${formatDebugClock(datetime, timezone ?? undefined)}`}</span>
        </div>
    )
}
