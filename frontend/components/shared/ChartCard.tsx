"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { CardLead } from "./CardLead"
import { ChartLegend } from "./ChartLegend"
import { MetricDeltaView, type MetricDelta, type MetricTone } from "./Metric"

export interface ChartCardProps {
    title: string
    subtitle?: string
    /** Leading icon (CardLead), like `Metric`. */
    lead?: LucideIcon
    tone?: MetricTone
    legend?: readonly { label: string; color?: string }[]
    delta?: MetricDelta
    /** Trailing slot of the header (granularity control, export, kebab). */
    actions?: React.ReactNode
    /** The chart. Receives the remaining height; give it `h-full`. */
    children?: React.ReactNode
    loading?: boolean
    /** No data for the period: shows this text instead of the chart. */
    empty?: string
    error?: { message?: string; onRetry?: () => void }
    /** Body height. Default `h-56`. Pass a Tailwind height class. */
    bodyClassName?: string
    className?: string
}

const toneIcon: Record<MetricTone, string> = {
    neutral: "text-muted-foreground",
    success: "text-success-text",
    warning: "text-warning-text",
    destructive: "text-destructive",
    info: "text-info",
}

/**
 * Panel of the family (ADR-0097/0149) for a chart with a header: icon, title, subtitle, legend and
 * change. It shares the header pieces of `Metric` but the figure is not the protagonist — the chart is.
 */
export function ChartCard({
    title, subtitle, lead: Lead, tone = "neutral", legend, delta, actions, children,
    loading = false, empty, error, bodyClassName = "h-56", className,
}: ChartCardProps) {
    let body: React.ReactNode
    if (loading) {
        body = <Skeleton className="size-full" />
    } else if (error) {
        body = (
            <div className="grid size-full place-content-center gap-1 text-center text-xs text-muted-foreground" role="alert">
                <p>{error.message ?? "No se pudo cargar el gráfico."}</p>
                {error.onRetry && (
                    // eslint-disable-next-line no-restricted-syntax -- inline text link inside the message; a Shadcn <Button> would break the line
                    <button type="button" onClick={error.onRetry} className="font-semibold text-foreground underline underline-offset-2 hover:no-underline">Reintentar</button>
                )}
            </div>
        )
    } else if (empty) {
        body = <p className="grid size-full place-content-center text-center text-xs text-muted-foreground">{empty}</p>
    } else {
        body = children
    }

    return (
        <section className={cn("surface-panel flex min-w-0 flex-col gap-3 px-3 py-2.5 text-card-foreground [[data-density=comfortable]_&]:px-4 [[data-density=comfortable]_&]:py-3", className)} aria-busy={loading || undefined}>
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-2.5">
                    {Lead && (
                        <CardLead size="sm" className={cn("size-7", toneIcon[tone])}>
                            <Lead className="h-4 w-4" aria-hidden="true" />
                        </CardLead>
                    )}
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold leading-tight tracking-tight">{title}</h3>
                        {subtitle && <p className="text-2xs leading-snug text-muted-foreground">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {legend && legend.length > 0 && <ChartLegend items={[...legend]} />}
                    {delta && <MetricDeltaView delta={delta} />}
                    {actions}
                </div>
            </header>
            <div className={cn("min-h-0", bodyClassName)}>{body}</div>
        </section>
    )
}
