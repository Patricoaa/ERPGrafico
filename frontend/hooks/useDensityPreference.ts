"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

/**
 * Per-device UI density preference (ADR-0142 D5). `compact` is the default (ADR-0070); `comfortable`
 * raises the dial to --k = 1.125 for the whole app chrome. Tables keep their own `data-density`
 * (DataTable/Collection `density` prop), so comfortable does not change data-table rows.
 * Stored in localStorage (device-level on purpose: a tablet and a desktop can differ).
 */
export type DensityPreference = "compact" | "comfortable"

const STORAGE_KEY = "ui_density"
const EVENT_NAME = "ui_density_changed" as const

function readStored(): DensityPreference {
    if (typeof window === "undefined") return "compact"
    try {
        return localStorage.getItem(STORAGE_KEY) === "comfortable" ? "comfortable" : "compact"
    } catch {
        return "compact"
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener(EVENT_NAME, onChange)
    window.addEventListener("storage", onChange)
    return () => {
        window.removeEventListener(EVENT_NAME, onChange)
        window.removeEventListener("storage", onChange)
    }
}

export function useDensityPreference() {
    const density = useSyncExternalStore(subscribe, readStored, () => "compact" as DensityPreference)

    const setDensity = useCallback((next: DensityPreference) => {
        try {
            if (next === "compact") localStorage.removeItem(STORAGE_KEY)
            else localStorage.setItem(STORAGE_KEY, next)
        } catch {
            /* storage unavailable: the preference is not persisted */
        }
        window.dispatchEvent(new Event(EVENT_NAME))
    }, [])

    return { density, setDensity }
}

/** Publishes the preference on `<html data-density>` (mount once, in the root providers). */
export function useApplyDensityPreference() {
    const { density } = useDensityPreference()
    useEffect(() => {
        const root = document.documentElement
        if (density === "comfortable") root.setAttribute("data-density", "comfortable")
        else root.removeAttribute("data-density")
        return () => root.removeAttribute("data-density")
    }, [density])
}
