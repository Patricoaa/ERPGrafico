"use client"

import * as React from "react"
import Link from "next/link"
import { Info, Minus, TrendingDown, TrendingUp, Check, ChevronRight, type LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, EMPTY_VALUE, isMissing } from "@/lib/utils"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import { StatusBadge } from "./StatusBadge"
import { CardLead } from "./CardLead"
import { cardAnatomy } from "./card-anatomy"

/**
 * Metric — the card of the `metric` role (ADR-0097, ADR-0149): one figure with its label, change,
 * context and, at most, one visual. Replaced the former `StatCard`. See docs/20-contracts/component-metric.md.
 */

// ── Types ───────────────────────────────────────────────────────────────────────────────────

/** Tone carries meaning (overdue, deficit, inflow/outflow). `neutral` is the default; never decorative. */
export type MetricTone = "neutral" | "success" | "warning" | "destructive" | "info"

export type MetricDelta =
    | {
        /** Value now. The component computes the % change against `previous`. */
        current: number
        previous: number
        /** A decrease is good (costs, overdue items). Flips success/destructive. */
        inverse?: boolean
        /** Decimals of the percentage. Default 1. */
        decimals?: number
    }
    | {
        /** Pre-formatted change when it is not a simple % of two numbers (e.g. "+3 pts"). */
        text: string
        direction: "up" | "down" | "flat"
        tone?: MetricTone
    }

export type MetricVisual =
    | { kind: "progress"; current: number; max: number; /** Unit noun after the count, e.g. "órdenes cobradas". */ noun?: string }
    | { kind: "spark"; data: readonly number[]; /** Required: says what the line is and its range, so it is data and not decoration. */ caption: string }
    | { kind: "facts"; items: readonly { label: string; value: React.ReactNode }[] }

export interface MetricHealth {
    /** Status string resolved by `StatusBadge` (the only status renderer, invariant 7). */
    status: string
    label?: string
    intent?: BadgeIntent
}

export interface MetricProps {
    /** Name of the figure. Rendered in the card eyebrow style. */
    label: string
    /** Definition of the figure, shown in a keyboard-reachable tooltip next to the label. */
    info?: string
    /** Leading icon (CardLead). The tone colors only the icon. */
    lead?: LucideIcon
    tone?: MetricTone
    /** The figure. `null`/`undefined` renders "—" (no data). Use `format*` helpers before passing. */
    value?: React.ReactNode
    /** Unit after the figure ("uds", "%"). */
    unit?: string
    delta?: MetricDelta
    /** One line: previous value, period or meaning. Text, never color alone. */
    context?: React.ReactNode
    health?: MetricHealth
    visual?: MetricVisual
    /** Navigates (stretched link on the label). */
    href?: string
    /** Toggle/filter mode: the label is a button with `aria-pressed`. Pair it with `pressed`. */
    onPress?: () => void
    pressed?: boolean
    /** Visible text shown while `pressed`. Default "Filtrando". */
    pressedLabel?: string
    loading?: boolean
    /** Failed load: shows "—" and the message with an optional retry. */
    error?: { message?: string; onRetry?: () => void }
    className?: string
}

// ── Tone maps (semantic tokens only) ────────────────────────────────────────────────────────

const toneText: Record<MetricTone, string> = {
    neutral: "text-muted-foreground",
    success: "text-success-text",
    warning: "text-warning-text",
    destructive: "text-destructive",
    info: "text-info",
}

const toneFill: Record<MetricTone, string> = {
    neutral: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    info: "bg-info",
}

// ── Delta ───────────────────────────────────────────────────────────────────────────────────

export interface ResolvedDelta {
    text: string
    direction: "up" | "down" | "flat"
    tone: MetricTone
}

const NBSP = " "

/** Pure: turns a `MetricDelta` into what is drawn. Returns `null` when there is nothing to compare. */
export function resolveMetricDelta(delta: MetricDelta): ResolvedDelta | null {
    if ("text" in delta) return { text: delta.text, direction: delta.direction, tone: delta.tone ?? "neutral" }
    const { current, previous, inverse = false, decimals = 1 } = delta
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
    const pct = ((current - previous) / Math.abs(previous)) * 100
    const text = `${new Intl.NumberFormat("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(pct))}${NBSP}%`
    if (Math.abs(pct) < 0.5 * 10 ** -decimals) return { text, direction: "flat", tone: "neutral" }
    const direction = pct > 0 ? "up" : "down"
    const good = inverse ? pct < 0 : pct > 0
    return { text, direction, tone: good ? "success" : "destructive" }
}

const DIRECTION_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const
const DIRECTION_WORD = { up: "Sube", down: "Baja", flat: "Sin cambio" } as const

/** The change badge: arrow + figure, colored by tone. Shared by `Metric` and `ChartCard`. */
export function MetricDeltaView({ delta, className }: { delta: MetricDelta; className?: string }) {
    const resolved = resolveMetricDelta(delta)
    if (!resolved) return null
    const Icon = DIRECTION_ICON[resolved.direction]
    return (
        <span
            className={cn("inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-bold tabular-nums", toneText[resolved.tone], className)}
            aria-label={`${DIRECTION_WORD[resolved.direction]} ${resolved.direction === "flat" ? "" : resolved.text}`.trim()}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-hidden="true">{resolved.text}</span>
        </span>
    )
}

// ── Visuals ─────────────────────────────────────────────────────────────────────────────────

function Progress({ visual, tone }: { visual: Extract<MetricVisual, { kind: "progress" }>; tone: MetricTone }) {
    const { current, max, noun } = visual
    const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((current / max) * 100))) : 0
    return (
        <div>
            <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={current}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={noun ? `${current} de ${max} ${noun}` : undefined}
            >
                <div className={cn("h-full rounded-full", toneFill[tone])} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-2xs tabular-nums text-muted-foreground">
                <span><b className="font-semibold text-foreground">{current}</b> de {max}{noun ? ` ${noun}` : ""}</span>
                <b className="font-semibold text-foreground">{pct}{NBSP}%</b>
            </div>
        </div>
    )
}

const SPARK_W = 200
const SPARK_H = 40
const SPARK_PAD = 4

function Spark({ visual }: { visual: Extract<MetricVisual, { kind: "spark" }> }) {
    const { data, caption } = visual
    if (data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const span = max - min || 1
    const pts = data.map((v, i) => [
        SPARK_PAD + (i * (SPARK_W - 2 * SPARK_PAD)) / (data.length - 1),
        SPARK_H - SPARK_PAD - ((v - min) / span) * (SPARK_H - 2 * SPARK_PAD),
    ] as const)
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
    const [lastX, lastY] = pts[pts.length - 1]
    const area = `${line} L${lastX.toFixed(1)} ${SPARK_H} L${pts[0][0].toFixed(1)} ${SPARK_H} Z`
    return (
        <div>
            <svg className="block h-10 w-full overflow-visible" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" role="img" aria-label={caption}>
                <path d={area} fill="var(--chart-1)" fillOpacity={0.14} />
                <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <circle cx={lastX} cy={lastY} r={3} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="mt-1 text-2xs tabular-nums text-muted-foreground">{caption}</p>
        </div>
    )
}

function Facts({ visual }: { visual: Extract<MetricVisual, { kind: "facts" }> }) {
    return (
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-2.5">
            {visual.items.map((f) => (
                <div key={f.label} className="min-w-0">
                    <dt className={cn(cardAnatomy.eyebrow, "text-4xs")}>{f.label}</dt>
                    <dd className="m-0 mt-0.5 truncate font-mono text-xs font-semibold tabular-nums">{f.value}</dd>
                </div>
            ))}
        </dl>
    )
}

function VisualSlot({ visual, tone }: { visual: MetricVisual; tone: MetricTone }) {
    switch (visual.kind) {
        case "progress": return <Progress visual={visual} tone={tone} />
        case "spark": return <Spark visual={visual} />
        case "facts": return <Facts visual={visual} />
    }
}

// ── Surface ─────────────────────────────────────────────────────────────────────────────────

/** Set by `MetricStrip`: the cell drops its own surface (the strip draws one). */
export const MetricEmbeddedContext = React.createContext(false)

const surfaceBase = "@container relative flex min-w-0 flex-col gap-1 px-3 py-2.5 text-left text-card-foreground [[data-density=comfortable]_&]:gap-1.5 [[data-density=comfortable]_&]:px-4 [[data-density=comfortable]_&]:py-3"
const surfaceOwn = "surface-panel"
// Inset hairlines on the top/left edge: a later sibling paints over an outer shadow, never over its own inset one.
const surfaceCell = "bg-card shadow-[inset_1px_0_0_0_var(--border),inset_0_1px_0_0_var(--border)]"
const surfaceInteractive = "transition-colors hover:border-foreground/30 hover:bg-muted/30 has-[[data-metric-control]:focus-visible]:ring-2 has-[[data-metric-control]:focus-visible]:ring-primary has-[[data-metric-control]:focus-visible]:ring-offset-2"
const surfacePressed = "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-card"

// ── Metric ──────────────────────────────────────────────────────────────────────────────────

export function Metric({
    label, info, lead: Lead, tone = "neutral", value, unit, delta, context, health, visual,
    href, onPress, pressed, pressedLabel = "Filtrando", loading = false, error, className,
}: MetricProps) {
    const embedded = React.useContext(MetricEmbeddedContext)
    const describedBy = React.useId()
    const interactive = href !== undefined || onPress !== undefined

    const surface = cn(
        surfaceBase,
        embedded ? surfaceCell : surfaceOwn,
        interactive && surfaceInteractive,
        interactive && !embedded && "cursor-pointer",
        pressed && !embedded && surfacePressed,
        pressed && embedded && "bg-muted/40",
        className,
    )

    if (loading) {
        return (
            <div className={cn(surface, "gap-2")} role="status" aria-label="Cargando" aria-busy="true">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-3 w-5/6" />
            </div>
        )
    }

    const hasError = error !== undefined
    const missing = hasError || isMissing(value)
    const shownValue = missing ? EMPTY_VALUE : value
    const labelClass = cn(cardAnatomy.eyebrow, "min-w-0 flex-1 text-left leading-tight text-balance")
    const stretched = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"

    let labelNode: React.ReactNode
    if (href !== undefined) {
        labelNode = <Link href={href} data-metric-control className={cn(labelClass, stretched)} aria-describedby={describedBy}>{label}</Link>
    } else if (onPress !== undefined) {
        // eslint-disable-next-line no-restricted-syntax -- the label IS the card's control (stretched button); a Shadcn <Button> would add its own chrome
        labelNode = <button type="button" data-metric-control onClick={onPress} aria-pressed={pressed ?? false} className={cn(labelClass, stretched)} aria-describedby={describedBy}>{label}</button>
    } else {
        labelNode = <span className={labelClass}>{label}</span>
    }

    const resolvedDelta = delta ? resolveMetricDelta(delta) : null

    return (
        <div className={surface}>
            <div className="flex min-h-7 items-center gap-2">
                {labelNode}
                {info && (
                    <TooltipProvider>
                        <Tooltip delayDuration={150}>
                            <TooltipTrigger asChild>
                                {/* eslint-disable-next-line no-restricted-syntax -- icon-only tooltip trigger inside the label row; action buttons require text content */}
                                <button
                                    type="button"
                                    aria-label={`${label}: qué mide`}
                                    className="relative z-10 -ml-1 grid size-5 shrink-0 cursor-help place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-64 text-balance text-xs leading-relaxed">{info}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {Lead && (
                    <CardLead size="sm" className={cn("size-7", toneText[tone])}>
                        <Lead className="h-4 w-4" aria-hidden="true" />
                    </CardLead>
                )}
            </div>

            <div id={describedBy} className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className={cn("kpi-value whitespace-nowrap @max-[230px]:kpi-value-compact", missing && "text-muted-foreground")}>
                    {shownValue}
                </span>
                {!missing && unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
                {!missing && delta && resolvedDelta && <MetricDeltaView delta={delta} />}
            </div>

            {health && !missing && (
                <StatusBadge status={health.status} label={health.label} intent={health.intent} size="xs" className="self-start" />
            )}

            {hasError ? (
                <p className="text-2xs leading-snug text-muted-foreground" role="alert">
                    {error.message ?? "No se pudo cargar."}
                    {error.onRetry && (
                        <>
                            {" "}
                            {/* eslint-disable-next-line no-restricted-syntax -- inline text link inside the message; a Shadcn <Button> would break the line */}
                            <button type="button" onClick={error.onRetry} className="relative z-10 font-semibold text-foreground underline underline-offset-2 hover:no-underline">Reintentar</button>
                        </>
                    )}
                </p>
            ) : context !== undefined && context !== null ? (
                <div className="text-2xs leading-snug text-muted-foreground text-pretty [&_b]:font-semibold [&_b]:tabular-nums [&_b]:text-foreground">{context}</div>
            ) : null}

            {visual && !missing && <div className="mt-1.5"><VisualSlot visual={visual} tone={tone} /></div>}

            {(pressed || href !== undefined) && (
                <div className="mt-0.5 flex items-center justify-end gap-1 text-2xs font-semibold text-foreground">
                    {pressed && <><Check className="h-3.5 w-3.5" aria-hidden="true" />{pressedLabel}</>}
                    {href !== undefined && !pressed && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                </div>
            )}
        </div>
    )
}
