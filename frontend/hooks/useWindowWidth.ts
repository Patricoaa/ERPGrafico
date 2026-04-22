"use client"

import { useState, useEffect, useCallback, useRef } from "react"

/**
 * Shared hook for responsive window width tracking with throttle.
 * Replaces the copy-pasted resize pattern across 5+ sheet components.
 * 
 * @param throttleMs - Minimum ms between state updates (default 150ms)
 * @param enabled - Only listen when component is active (e.g., sheet is open)
 */
export function useWindowWidth(throttleMs = 150, enabled = true): number {
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1200
    )
    const lastUpdateRef = useRef(0)
    const rafRef = useRef<number | null>(null)

    const handleResize = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)

        rafRef.current = requestAnimationFrame(() => {
            const now = Date.now()
            if (now - lastUpdateRef.current >= throttleMs) {
                setWindowWidth(window.innerWidth)
                lastUpdateRef.current = now
            } else {
                // Schedule a delayed update for the trailing edge
                const remaining = throttleMs - (now - lastUpdateRef.current)
                setTimeout(() => {
                    setWindowWidth(window.innerWidth)
                    lastUpdateRef.current = Date.now()
                }, remaining)
            }
        })
    }, [throttleMs])

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return

        // Sync on mount / when enabled changes
        requestAnimationFrame(() => {
            setWindowWidth(window.innerWidth)
            lastUpdateRef.current = Date.now()
        })

        window.addEventListener('resize', handleResize, { passive: true })
        return () => {
            window.removeEventListener('resize', handleResize)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [enabled, handleResize])

    return windowWidth
}
