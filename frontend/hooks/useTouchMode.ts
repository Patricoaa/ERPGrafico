"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

/**
 * Input axis of the density dial (ADR-0142 D5): `auto` follows the pointer
 * (`pointer: coarse` → touch), `touch` / `mouse` force it. CSS reads it from
 * `html[data-input]` (see `useApplyInputMode`), so styling needs no JS branches:
 * use the `touch:` variant. This hook only exposes the *resolved* boolean for
 * BEHAVIOUR (numpad on tap, decimals…), never for sizes.
 */
export type InputMode = "auto" | "touch" | "mouse"

const STORAGE_KEY = "pos_input_mode"
const EVENT_NAME = "pos_input_mode_changed" as const
const COARSE_QUERY = "(pointer: coarse)"

function readStoredMode(): InputMode {
    if (typeof window === "undefined") return "auto"
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        return stored === "touch" || stored === "mouse" ? stored : "auto"
    } catch {
        return "auto"
    }
}

function isCoarsePointer(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(COARSE_QUERY).matches
}

function subscribe(onChange: () => void) {
    window.addEventListener(EVENT_NAME, onChange)
    window.addEventListener("storage", onChange)
    const media = typeof window.matchMedia === "function" ? window.matchMedia(COARSE_QUERY) : null
    media?.addEventListener?.("change", onChange)
    return () => {
        window.removeEventListener(EVENT_NAME, onChange)
        window.removeEventListener("storage", onChange)
        media?.removeEventListener?.("change", onChange)
    }
}

export function useTouchMode() {
    // External stores (sessionStorage + pointer media query): the server snapshot is deterministic
    // (auto / fine), so SSR and the first client render agree.
    const inputMode = useSyncExternalStore(subscribe, readStoredMode, () => "auto" as InputMode)
    const coarse = useSyncExternalStore(subscribe, isCoarsePointer, () => false)

    const setInputMode = useCallback((mode: InputMode) => {
        try {
            if (mode === "auto") sessionStorage.removeItem(STORAGE_KEY)
            else sessionStorage.setItem(STORAGE_KEY, mode)
        } catch {
            /* storage unavailable: the choice lasts only until the next read */
        }
        window.dispatchEvent(new Event(EVENT_NAME))
    }, [])

    const isTouchMode = inputMode === "touch" || (inputMode === "auto" && coarse)

    const toggleTouchMode = useCallback(() => {
        setInputMode(isTouchMode ? "mouse" : "touch")
    }, [isTouchMode, setInputMode])

    return { isTouchMode, inputMode, setInputMode, toggleTouchMode }
}

/**
 * Publishes the input mode on `<html data-input>` while the calling surface is mounted, so the
 * dial (`--k`, hit targets, `touch:` variant) also reaches portaled content (dialogs, sheets).
 * Mount it once per surface (POSShell).
 */
export function useApplyInputMode() {
    const { inputMode } = useTouchMode()
    useEffect(() => {
        const root = document.documentElement
        const previous = root.getAttribute("data-input")
        root.setAttribute("data-input", inputMode)
        return () => {
            if (previous === null) root.removeAttribute("data-input")
            else root.setAttribute("data-input", previous)
        }
    }, [inputMode])
}
