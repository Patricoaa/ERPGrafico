"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { MetricEmbeddedContext } from "./Metric"

export interface MetricStripProps {
    /** Accessible name of the group ("Indicadores del producto"). */
    label: string
    /** 2 to 4 `Metric` cells. Each drops its own surface and shares the strip's. */
    children: React.ReactNode
    /** Keeps every cell on one row at any width (no 1 → 2 → 4 reflow). For strips whose cells stay short. */
    singleRow?: boolean
    className?: string
}

const SINGLE_ROW: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
}

/**
 * Columns by cell count, by the strip's own width (container queries, so it behaves the same in a
 * modal, a drawer or a page). Every row is full: 4 cells go 1 → 2 → 4, 3 cells go 1 → 3, never 3 + 1.
 * Beyond 4 the strip stops being scannable: split it into two strips.
 */
const COLUMNS: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 @[28rem]:grid-cols-2",
    3: "grid-cols-1 @[40rem]:grid-cols-3",
    4: "grid-cols-1 @[28rem]:grid-cols-2 @[52rem]:grid-cols-4",
}

/**
 * Several `Metric`s on one surface, separated by hairline dividers (ADR-0149). One border for the
 * whole row instead of one per card.
 */
export function MetricStrip({ label, children, singleRow = false, className }: MetricStripProps) {
    const count = React.Children.toArray(children).length
    const index = Math.min(Math.max(count, 1), 4)
    const columns = singleRow ? SINGLE_ROW[index] : COLUMNS[index]
    return (
        <MetricEmbeddedContext.Provider value>
            <div role="group" aria-label={label} className={cn("surface-panel @container overflow-hidden", className)}>
                {/* -m-px pulls the first row/column hairlines under the surface border (clipped), leaving dividers only between cells */}
                <div className={cn("-ml-px -mt-px grid", columns)}>{children}</div>
            </div>
        </MetricEmbeddedContext.Provider>
    )
}
