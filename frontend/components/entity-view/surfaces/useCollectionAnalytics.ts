"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const PARAM = "analytics"

export interface CollectionAnalyticsState {
    /** The analytics modal is open (`?analytics=<tab>` in the URL). */
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Active analytics tab; the default while closed. */
    tab: string
    onTabChange: (tab: string) => void
}

export interface UseCollectionAnalyticsOptions {
    /**
     * Old `?view=<tab>` links that opened the analytics view on a tab (e.g. product
     * `?view=ventas`). They are rewritten to `?analytics=<tab>` once.
     */
    legacyViewTabs?: readonly string[]
}

/**
 * Analytics modal state in the URL (ADR-0158 §11, collection-toolbar §5.7): `?analytics=<tab>` opens
 * the modal on that tab, so it can be shared. Pass `open` / `onOpenChange` to `Collection.Root` and
 * `tab` / `onTabChange` to the feature's analytics screen; fetch analytics only while `open`.
 *
 * Compatibility: `?view=analytics` (the former analytics view) is rewritten to `?analytics=<defaultTab>`.
 */
export function useCollectionAnalytics(defaultTab: string, { legacyViewTabs = [] }: UseCollectionAnalyticsOptions = {}): CollectionAnalyticsState {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const param = searchParams.get(PARAM)
    const legacyView = searchParams.get("view")
    const legacyTab = legacyView === "analytics" ? defaultTab : legacyView !== null && legacyViewTabs.includes(legacyView) ? legacyView : null

    const write = React.useCallback(
        (next: string | null, mode: "push" | "replace") => {
            const params = new URLSearchParams(searchParams.toString())
            if (next === null) params.delete(PARAM)
            else params.set(PARAM, next)
            if (legacyTab !== null) params.delete("view")
            const query = params.toString()
            const href = query ? `${pathname}?${query}` : pathname
            if (mode === "push") router.push(href, { scroll: false })
            else router.replace(href, { scroll: false })
        },
        [searchParams, pathname, router, legacyTab],
    )

    React.useEffect(() => {
        if (legacyTab !== null && param === null) write(legacyTab, "replace")
    }, [legacyTab, param, write])

    const open = param !== null || legacyTab !== null
    const tab = param || legacyTab || defaultTab

    const onOpenChange = React.useCallback((next: boolean) => write(next ? tab : null, "push"), [write, tab])
    const onTabChange = React.useCallback((next: string) => write(next, "replace"), [write])

    return { open, onOpenChange, tab, onTabChange }
}
