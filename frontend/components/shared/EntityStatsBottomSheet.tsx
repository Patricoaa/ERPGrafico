"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Drawer } from "./Drawer"
import { StatCard } from "./StatCard"
import { ResponsiveBar } from "@nivo/bar"
import { ResponsivePie } from "@nivo/pie"
import { ResponsiveLine } from "@nivo/line"

// ── Shared types ──────────────────────────────────────────────

type Accent = "primary" | "info" | "success" | "warning" | "destructive" | "accent" | "muted"

export interface StatCardConfig {
    label: string
    value: React.ReactNode
    icon?: LucideIcon
    accent?: Accent
    subtext?: string
    variant?: "default" | "compact" | "minimal" | "hero" | "tile" | "progress"
    valueSize?: "sm" | "md" | "lg" | "xl"
    trend?: { direction: "up" | "down"; value: string; label?: string }
    progress?: { current: number; max: number }
    href?: string
    onClick?: () => void
    active?: boolean
    loading?: boolean
}

export interface TimelineEvent {
    date: string
    label: string
    description?: string
    status?: "success" | "warning" | "destructive" | "neutral"
}

interface ChartConfig {
    data: unknown
    height?: number
    colors?: unknown
    keys?: string[]
    indexBy?: string
    valueFormat?: string
    showLegend?: boolean
    innerRadius?: number
    enableLabels?: boolean
    arcLabel?: string
    enableArea?: boolean
}

export interface StatsPanel {
    id: string
    title?: string
    colSpan?: 1 | 2 | 3
    rowSpan?: 1 | 2
    content:
        | { type: "stat-card"; config: StatCardConfig }
        | { type: "bar-chart" | "pie-chart" | "line-chart"; config: ChartConfig }
        | { type: "custom"; render: React.ReactNode }
}

interface Segment {
    value: string
    label: string
    icon?: LucideIcon
}

interface EntityStatsBottomSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    icon?: LucideIcon
    panels: StatsPanel[]
    segments?: Segment[]
    activeSegment?: string
    onSegmentChange?: (value: string) => void
}

// ── Timeline view (exported for reuse) ────────────────────────

export function TimelineView({ events }: { events: TimelineEvent[] }) {
    if (!events.length) {
        return (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
                Sin eventos próximos
            </p>
        )
    }

    const statusColor = {
        success: "bg-success border-success/30",
        warning: "bg-warning border-warning/30",
        destructive: "bg-destructive border-destructive/30",
        neutral: "bg-muted border-border",
    }

    return (
        <div className="space-y-0">
            {events.map((event, i) => (
                <div key={i} className="flex gap-3 pb-4 relative last:pb-0">
                    <div className="flex flex-col items-center">
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full border-2 mt-1.5 shrink-0",
                            statusColor[event.status || "neutral"],
                        )} />
                        {i < events.length - 1 && (
                            <div className="w-px flex-1 bg-border/50 mt-1" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                                {event.date}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                                {event.label}
                            </span>
                        </div>
                        {event.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {event.description}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function SummaryTable({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
    return (
        <div className="rounded-lg border border-border/50 overflow-hidden">
            {rows.map((row, i) => (
                <div
                    key={i}
                    className={cn(
                        "flex items-center justify-between px-4 py-2.5",
                        i % 2 === 0 ? "bg-card" : "bg-muted/20",
                    )}
                >
                    <span className="text-xs font-medium text-muted-foreground">
                        {row.label}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                        {row.value}
                    </span>
                </div>
            ))}
        </div>
    )
}

// ── Internal helpers ──────────────────────────────────────────

function chunkPanels(panels: StatsPanel[]): StatsPanel[][] {
    const pages: StatsPanel[][] = []
    let current: StatsPanel[] = []
    let sum = 0

    for (const panel of panels) {
        const span = panel.colSpan ?? 1
        if (sum > 0 && sum + span > 3) {
            pages.push(current)
            current = []
            sum = 0
        }
        current.push(panel)
        sum += span
    }

    if (current.length > 0) {
        pages.push(current)
    }

    return pages
}

function PanelItem({ panel }: { panel: StatsPanel }) {
    const colSpan = panel.colSpan ?? 1
    const rowSpan = panel.rowSpan ?? 1

    const gridStyle: React.CSSProperties = {
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
    }

    if (panel.content.type === "stat-card") {
        const card = panel.content.config
        const statVariant = card.variant === "compact" || card.variant === "minimal"
            ? card.variant
            : undefined
        return (
            <div className="flex flex-col" style={gridStyle}>
                {panel.title && (
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                        {panel.title}
                    </h4>
                )}
                <StatCard
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    accent={card.accent}
                    subtext={card.subtext}
                    variant={statVariant}
                    valueSize={card.valueSize}
                    trend={card.trend}
                    href={card.href}
                    onClick={card.onClick}
                    active={card.active}
                    loading={card.loading}
                />
            </div>
        )
    }

    return (
        <div
            className="rounded-xl border border-border/50 bg-card p-4 shadow-sm flex flex-col min-h-[180px]"
            style={gridStyle}
        >
            {panel.title && (
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                    {panel.title}
                </h4>
            )}
            {panel.content.type === "custom" ? (
                <div className="flex-1">{panel.content.render}</div>
            ) : (
                <div className="flex-1 min-h-0">
                    <ChartRenderer type={panel.content.type} config={panel.content.config} />
                </div>
            )}
        </div>
    )
}

function ChartRenderer({
    type,
    config,
}: {
    type: "bar-chart" | "pie-chart" | "line-chart"
    config: ChartConfig
}) {
    const height = config.height ?? 250
    const colors = config.colors as any

    switch (type) {
        case "bar-chart":
            return (
                <div style={{ height }}>
                    <ResponsiveBar
                        data={config.data as any}
                        keys={config.keys ?? []}
                        indexBy={config.indexBy ?? "id"}
                        padding={0.3}
                        borderRadius={4}
                        colors={colors}
                        axisBottom={{ tickSize: 0, tickPadding: 12 }}
                        axisLeft={{ tickSize: 0, tickPadding: 12 }}
                        valueFormat={config.valueFormat}
                        legends={config.showLegend ? [{
                            dataFrom: "keys" as const,
                            anchor: "bottom" as const,
                            direction: "row" as const,
                            translateY: 45,
                            itemWidth: 80,
                            itemHeight: 20,
                            symbolSize: 10,
                            symbolShape: "circle" as const,
                        }] : []}
                    />
                </div>
            )
        case "pie-chart":
            return (
                <div style={{ height }}>
                    <ResponsivePie
                        data={config.data as any}
                        innerRadius={config.innerRadius ?? 0}
                        padAngle={1}
                        cornerRadius={4}
                        colors={colors}
                        borderWidth={1}
                        borderColor={{ theme: "background" }}
                        enableArcLinkLabels={config.enableLabels ?? true}
                        arcLabel={config.arcLabel ?? "id"}
                        arcLabelsRadiusOffset={0.55}
                        legends={config.showLegend ? [{
                            anchor: "bottom" as const,
                            direction: "row" as const,
                            translateY: 45,
                            itemWidth: 80,
                            itemHeight: 20,
                            symbolSize: 10,
                            symbolShape: "circle" as const,
                        }] : []}
                    />
                </div>
            )
        case "line-chart":
            return (
                <div style={{ height }}>
                    <ResponsiveLine
                        data={config.data as any}
                        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                        curve="monotoneX"
                        lineWidth={2}
                        pointSize={5}
                        colors={colors}
                        enableArea={config.enableArea ?? false}
                        axisBottom={{ tickSize: 0, tickPadding: 12 }}
                        axisLeft={{ tickSize: 0, tickPadding: 12 }}
                        legends={config.showLegend ? [{
                            anchor: "bottom" as const,
                            direction: "row" as const,
                            translateY: 45,
                            itemWidth: 80,
                            itemHeight: 20,
                            symbolSize: 10,
                            symbolShape: "circle" as const,
                        }] : []}
                    />
                </div>
            )
    }
}

// ── Main component ────────────────────────────────────────────

export function EntityStatsBottomSheet({
    open,
    onOpenChange,
    title,
    description,
    icon,
    panels,
    segments,
    activeSegment,
    onSegmentChange,
}: EntityStatsBottomSheetProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [currentPage, setCurrentPage] = useState(0)

    const pages = useMemo(() => chunkPanels(panels), [panels])
    const isFirst = currentPage === 0
    const isLast = currentPage === pages.length - 1

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setCurrentPage(Number(entry.target.getAttribute("data-page")))
                    }
                }
            },
            { root: el, threshold: 0.5 },
        )

        const items = el.querySelectorAll("[data-page]")
        items.forEach((item) => observer.observe(item))
        return () => observer.disconnect()
    }, [pages.length])

    useEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTo({ left: 0 })
        setCurrentPage(0)
    }, [panels])

    const scroll = useCallback((dir: "prev" | "next") => {
        const el = scrollRef.current
        if (!el) return
        const sign = dir === "next" ? 1 : -1
        el.scrollBy({ left: sign * el.clientWidth, behavior: "smooth" })
    }, [])

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            icon={icon}
            side="bottom"
            defaultSize="60vh"
            resizable={false}
        >
            {segments && activeSegment && onSegmentChange && (
                <div className="flex gap-1 px-6 pt-3 pb-2 border-b overflow-x-auto scrollbar-none">
                    {segments.map((seg) => {
                        const SegIcon = seg.icon
                        const isActive = activeSegment === seg.value
                        return (
                            <Button
                                key={seg.value}
                                variant={isActive ? "default" : "ghost"}
                                size="sm"
                                onClick={() => onSegmentChange(seg.value)}
                                className="text-[10px] font-black uppercase tracking-widest shrink-0 h-auto px-3 py-1.5"
                            >
                                {SegIcon && <SegIcon className="h-3 w-3" />}
                                {seg.label}
                            </Button>
                        )
                    })}
                </div>
            )}

            <div
                ref={scrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none pt-4"
            >
                {pages.map((pagePanels, pageIdx) => (
                    <div
                        key={pageIdx}
                        data-page={pageIdx}
                        className="min-w-full shrink-0 snap-start grid grid-cols-3 auto-rows-auto gap-4 px-6"
                    >
                        {pagePanels.map((panel) => (
                            <PanelItem key={panel.id} panel={panel} />
                        ))}
                    </div>
                ))}
            </div>

            {pages.length > 1 && (
                <div className="flex items-center justify-center gap-3 px-6 pb-4 pt-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        disabled={isFirst}
                        onClick={() => scroll("prev")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                        {currentPage + 1}/{pages.length}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        disabled={isLast}
                        onClick={() => scroll("next")}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </Drawer>
    )
}
