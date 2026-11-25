"use client"

import * as React from "react"
import type { AnalyticsDrillDownFilter, ChartDrillDown } from "./types"

type DrillDownHandler = (filter: AnalyticsDrillDownFilter) => void

const AnalyticsDrillDownContext = React.createContext<DrillDownHandler | null>(null)

/** Gives drillable charts their click target (ADR-0158 §11). `Collection.Analytics` mounts it. */
export function AnalyticsDrillDownProvider({ onDrillDown, children }: { onDrillDown: DrillDownHandler; children: React.ReactNode }) {
    return <AnalyticsDrillDownContext.Provider value={onDrillDown}>{children}</AnalyticsDrillDownContext.Provider>
}

/**
 * Click handler for one chart: `null` when the chart declares no `drillDown` or nothing listens.
 * The clicked category goes through `drillDown.values` when declared; an unmapped one is ignored.
 */
export function useAnalyticsDrillDown(drillDown: ChartDrillDown | undefined): ((category: string | number) => void) | null {
    const handler = React.useContext(AnalyticsDrillDownContext)
    return React.useMemo(() => {
        if (!drillDown || !handler) return null
        return (category: string | number) => {
            const key = String(category)
            const value = drillDown.values ? drillDown.values[key] : key
            if (value !== undefined && value !== "") handler({ param: drillDown.param, value })
        }
    }, [drillDown, handler])
}
