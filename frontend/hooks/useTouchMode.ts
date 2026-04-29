"use client"

import { useState, useEffect, useCallback } from "react"

const EVENT_NAME = "pos_touch_mode_changed"

export function useTouchMode() {
    const [isTouchMode, setIsTouchMode] = useState(true)

    const syncState = useCallback(() => {
        const stored = sessionStorage.getItem("pos_touch_mode")
        if (stored !== null) {
            setIsTouchMode(stored === "true")
        }
    }, [])

    useEffect(() => {
        syncState()
        window.addEventListener(EVENT_NAME, syncState)
        window.addEventListener("storage", syncState)

        return () => {
            window.removeEventListener(EVENT_NAME, syncState)
            window.removeEventListener("storage", syncState)
        }
    }, [syncState])

    const toggleTouchMode = () => {
        const next = !isTouchMode
        sessionStorage.setItem("pos_touch_mode", String(next))
        setIsTouchMode(next)
        window.dispatchEvent(new Event(EVENT_NAME))
    }

    return { isTouchMode, toggleTouchMode }
}
