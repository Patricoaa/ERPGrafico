"use client"

import * as React from "react"
import { parseAsString, useQueryState } from "nuqs"

/** What the analytics modal measures: the collection's current query, or everything (ADR-0158 §11). */
export type AnalyticsScope = "query" | "all"

export interface CollectionAnalyticsState {
    /** The analytics modal is open (`?analytics=<tab>` in the URL). */
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Active analytics tab; the default while closed. */
    tab: string
    onTabChange: (tab: string) => void
    /** «Analizar sin filtros» switches to `"all"` inside the modal only; closing goes back to `"query"`. */
    scope: AnalyticsScope
    onScopeChange: (scope: AnalyticsScope) => void
}

export interface UseCollectionAnalyticsOptions {
    /**
     * Old `?view=<tab>` links that opened the analytics view on a tab (e.g. product
     * `?view=ventas`). They are rewritten to `?analytics=<tab>` once.
     */
    legacyViewTabs?: readonly string[]
}

const analyticsParam = parseAsString.withOptions({ history: "push", scroll: false })

/**
 * Analytics modal state in the URL (ADR-0158 §11, collection-toolbar §5.7): `?analytics=<tab>` opens
 * the modal on that tab, so it can be shared. Pass the result to `Collection.Root analytics` and
 * `tab` / `onTabChange` to the feature's analytics screen; fetch analytics only while `open`, with the
 * list filters unless `scope` is `"all"`.
 *
 * Written through nuqs like the collection query, so a drill-down (filter + close) is one URL update.
 * Compatibility: `?view=analytics` (the former analytics view) is rewritten to `?analytics=<defaultTab>`.
 */
export function useCollectionAnalytics(defaultTab: string, { legacyViewTabs = [] }: UseCollectionAnalyticsOptions = {}): CollectionAnalyticsState {
    const [param, setParam] = useQueryState("analytics", analyticsParam)
    const [legacyView, setLegacyView] = useQueryState("view", parseAsString)
    const [scope, setScope] = React.useState<AnalyticsScope>("query")

    const legacyTab = legacyView === "analytics" ? defaultTab : legacyView !== null && legacyViewTabs.includes(legacyView) ? legacyView : null

    React.useEffect(() => {
        if (legacyTab === null || param !== null) return
        void setLegacyView(null, { history: "replace" })
        void setParam(legacyTab, { history: "replace" })
    }, [legacyTab, param, setLegacyView, setParam])

    const open = param !== null || legacyTab !== null
    const tab = param || legacyTab || defaultTab

    const onOpenChange = React.useCallback(
        (next: boolean) => {
            if (!next) setScope("query")
            void setParam(next ? tab : null)
        },
        [setParam, tab],
    )
    const onTabChange = React.useCallback((next: string) => void setParam(next, { history: "replace" }), [setParam])

    return { open, onOpenChange, tab, onTabChange, scope, onScopeChange: setScope }
}
