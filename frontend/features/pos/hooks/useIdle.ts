"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const

/**
 * `true` cuando no hubo actividad del usuario durante `timeoutMs`. Se desactiva con `enabled = false`.
 * `wake()` fuerza la salida del estado inactivo y reinicia la cuenta.
 */
export function useIdle(timeoutMs: number, enabled = true): { idle: boolean; wake: () => void } {
    const [idle, setIdle] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const arm = useCallback(() => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setIdle(true), timeoutMs)
    }, [timeoutMs])

    const wake = useCallback(() => {
        setIdle(false)
        arm()
    }, [arm])

    useEffect(() => {
        if (!enabled) return
        arm()
        ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, arm, { passive: true }))
        return () => {
            ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, arm))
            if (timer.current) clearTimeout(timer.current)
        }
    }, [enabled, arm])

    return { idle: enabled && idle, wake }
}
