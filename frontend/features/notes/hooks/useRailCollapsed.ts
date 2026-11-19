"use client"

import { useCallback, useEffect, useState } from 'react'

/**
 * Estado colapsado de un rail lateral, persistido como preferencia del
 * navegador. Se restaura tras el montaje para no romper la hidratación.
 */
export function useRailCollapsed(storageKey: string) {
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        try {
            if (window.localStorage.getItem(storageKey) === '1') {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a browser preference after mount to avoid an SSR/client hydration mismatch
                setCollapsed(true)
            }
        } catch {
            // Storage can be unavailable
        }
    }, [storageKey])

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev
            try {
                window.localStorage.setItem(storageKey, next ? '1' : '0')
            } catch {
                // Ignore storage failures
            }
            return next
        })
    }, [storageKey])

    return { collapsed, toggle }
}
