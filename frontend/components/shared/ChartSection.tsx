"use client"

import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface ChartSectionProps {
    /** Heading rendered above the bordered container. */
    title: string
    /** Accessible name of the region when it must differ from the title. */
    label?: string
    /** Small explanatory text under the title. */
    note?: string
    /** Trailing slot of the title row (e.g. a segmented control). */
    actions?: ReactNode
    loading?: boolean
    /** No data for the period: shows this text inside the container instead of the chart. */
    empty?: string
    /** The chart; it brings its own height. */
    children?: ReactNode
    className?: string
}

/**
 * Standard layout of a chart in the analytics tabs: the title lives outside and the chart sits in a
 * bordered container. Every chart of the product analysis goes through here so they all look alike.
 */
export function ChartSection({ title, label, note, actions, loading = false, empty, children, className }: ChartSectionProps) {
    let body: ReactNode = children
    if (loading) body = <Skeleton className="h-56 w-full" />
    else if (empty) body = <p className="grid h-40 place-content-center text-center text-xs text-muted-foreground">{empty}</p>

    return (
        <section aria-label={label ?? title} aria-busy={loading || undefined} className={cn("flex flex-col gap-2", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{title}</h3>
                {actions}
            </div>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            <div className="surface-panel p-4">{body}</div>
        </section>
    )
}
