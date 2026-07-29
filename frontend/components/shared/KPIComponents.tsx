"use client"

import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

// ── KPIWrapper ──────────────────────────────────────────────────────────────
// Wraps a KPI card with a descriptive tooltip on hover.

export interface KPIWrapperProps {
    tooltip: string
    children: React.ReactNode
}

export function KPIWrapper({ tooltip, children }: KPIWrapperProps) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                    <div className="cursor-help flex flex-col h-full hover:brightness-95 dark:hover:brightness-110 transition-all">
                        {children}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px] p-3 text-balance">
                    <p className="text-xs leading-relaxed">{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// ── KPIValue ────────────────────────────────────────────────────────────────
// Renders a KPI value with optional period comparison (Actual / Anterior).

export interface KPIValueProps {
    current: number
    previous?: number
    showComparison?: boolean
    /** Render as percentage. Multiplies by 100 if `alreadyPercent` is false. */
    isPercentage?: boolean
    /** If true, value is already 0–100; if false (default), multiplied by 100. */
    alreadyPercent?: boolean
    isCurrency?: boolean
    decimals?: number
}

export function KPIValue({
    current,
    previous,
    showComparison,
    isPercentage = false,
    alreadyPercent = true,
    isCurrency = false,
    decimals,
}: KPIValueProps) {
    const fmt = (v: number | undefined) => {
        const val = v ? Number(v) : 0
        if (isCurrency) return formatMoney(val)
        if (isPercentage) {
            const pct = alreadyPercent ? val : val * 100
            return `${pct.toFixed(decimals ?? 1)}%`
        }
        return val.toFixed(decimals ?? 0)
    }

    if (!showComparison || previous === undefined) {
        return <>{fmt(current)}</>
    }

    return (
        <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-baseline gap-2 leading-none">
                <span>{fmt(current)}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Actual</span>
            </div>
            <div className="flex items-baseline gap-2 text-lg text-muted-foreground/90 leading-none">
                <span>{fmt(previous)}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest">Anterior</span>
            </div>
        </div>
    )
}

// ── DeltaBadge ──────────────────────────────────────────────────────────────
// Shows a % variation badge between two periods, colored semantically.
// `inverse=true` flips positive/negative coloring (e.g. for cost metrics).

export interface DeltaBadgeProps {
    current: number
    previous: number
    inverse?: boolean
    className?: string
}

export function DeltaBadge({ current, previous, inverse = false, className }: DeltaBadgeProps) {
    if (!previous) return null
    const delta = ((current - previous) / Math.abs(previous)) * 100
    const isGood = inverse ? delta < 0 : delta >= 0

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-[10px] font-bold',
                isGood ? 'text-success' : 'text-destructive',
                className,
            )}
        >
            {delta >= 0
                ? <TrendingUp className="h-2.5 w-2.5" />
                : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(delta).toFixed(1)}%
        </span>
    )
}

// ── SectionCard ─────────────────────────────────────────────────────────────
// Reusable card container for dashboard chart sections.

export interface SectionCardProps {
    title: string
    description?: string
    /** Height of the chart area. Defaults to "320px". */
    chartHeight?: string
    children: React.ReactNode
    className?: string
    /** Optional footer content rendered below the chart area */
    footer?: React.ReactNode
    /** Optional slot for right-aligned header content (like a legend or actions) */
    headerRight?: React.ReactNode
}

export function SectionCard({
    title,
    description,
    chartHeight = '320px',
    children,
    className,
    footer,
    headerRight,
}: SectionCardProps) {
    return (
        <div className={cn('flex flex-col rounded-xl border bg-card p-5 shadow-sm', className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                    <h3 className="text-base font-bold text-foreground">{title}</h3>
                    {description && (
                        <span className="text-sm text-muted-foreground mb-4">{description}</span>
                    )}
                </div>
                {headerRight && (
                    <div className="shrink-0 flex items-center">
                        {headerRight}
                    </div>
                )}
            </div>
            <div style={{ height: chartHeight }} className={cn(!description && "mt-4")}>
                {children}
            </div>
            {footer && <div className="mt-auto pt-4">{footer}</div>}
        </div>
    )
}
