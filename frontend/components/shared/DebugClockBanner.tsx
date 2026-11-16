"use client"

import { Clock } from "lucide-react"
import { useServerDate } from "@/hooks/useServerDate"
import { formatDebugClock } from "@/lib/debug-clock"

/**
 * Barra superior en el flujo que avisa que el reloj del servidor está alterado (ADR-0139 D4).
 * Solo se renderiza con `debug_clock` verdadero; ocupa su propia fila sobre el shell sin tapar controles.
 */
export function DebugClockBanner() {
    const { debugClock, datetime, timezone } = useServerDate()
    if (!debugClock || !datetime) return null

    return (
        <div
            role="status"
            className="flex h-5 shrink-0 items-center justify-center gap-1.5 bg-warning text-warning-foreground text-2xs font-semibold tabular-nums"
        >
            <Clock className="h-3 w-3" aria-hidden />
            <span>{`Reloj de depuración: ${formatDebugClock(datetime, timezone ?? undefined)}`}</span>
        </div>
    )
}
