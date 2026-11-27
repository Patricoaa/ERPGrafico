"use client"

import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function isMobileViewport(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches
}

function subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
    const media = window.matchMedia(MOBILE_QUERY)
    media.addEventListener?.("change", onChange)
    return () => media.removeEventListener?.("change", onChange)
}

/**
 * Narrow viewport (< md), as an external store: the server snapshot is deterministic (`false`), so
 * hydration never disagrees with the first client render. jsdom without `matchMedia` stays wide.
 */
export function useIsMobile() {
    return React.useSyncExternalStore(subscribe, isMobileViewport, () => false)
}
