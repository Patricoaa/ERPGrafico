"use client"

import React, { useState, useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import { LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { Drawer } from "./Drawer"
import { StatCard } from "./StatCard"
import { UnderlineTabs, UnderlineTabsContent } from "./UnderlineTabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ResponsiveBar } from "@nivo/bar"
import { ResponsivePie } from "@nivo/pie"
import { ResponsiveLine } from "@nivo/line"
import { ResponsiveCalendar } from "@nivo/calendar"
import { ResponsiveStream } from "@nivo/stream"
import { ResponsiveTreeMap } from "@nivo/treemap"
import { ResponsiveWaffle } from "@nivo/waffle"
import { ResponsiveRadar } from "@nivo/radar"

// ── Shared types ──────────────────────────────────────────────

type Accent = "primary" | "info" | "success" | "warning" | "destructive" | "accent" | "muted"

export interface StatCardConfig {
    label: string
    value?: React.ReactNode
    icon?: LucideIcon
    accent?: Accent
    subtext?: string
    variant?: "default" | "compact" | "minimal" | "fill" | "hero" | "tile" | "progress" | "chart" | "metric-chart"
    valueSize?: "sm" | "md" | "lg" | "xl"
    trend?: { direction: "up" | "down"; value: string; label?: string }
    progress?: { current: number; max: number }
    href?: string
    onClick?: () => void
    active?: boolean
    loading?: boolean
    /** Embed a chart inside the stat card */
    chart?: {
        type: "bar-chart" | "pie-chart" | "line-chart" | "calendar-heatmap" | "stream-chart" | "treemap-chart" | "waffle-chart" | "radar-chart"
        config: ChartConfig
    }
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
    arcLabel?: string | ((d: any) => string)
    enableArea?: boolean
    margin?: { top: number; right: number; bottom: number; left: number }
    /** Compact sparkline mode: removes axes, reduces margins */
    compact?: boolean
    enableGridX?: boolean
    enableGridY?: boolean
    /** Border radius for bar corners (default 0). Use 4 for subtle rounding matching --radius-sm */
    borderRadius?: number
    /** Overlay a line series on top of bar chart (combo chart) */
    lineOverlay?: {
        dataKey: string
        label: string
        color?: string
    }
    axisBottomLegend?: string
    axisLeftLegend?: string
    /** Which field to use for legend items: "keys" (bar keys) or "indexes" (data ids, for pie) */
    legendDataFrom?: "keys" | "indexes"
    // ── Calendar heatmap ──
    /** Direction: "horizontal" (default) or "vertical" */
    calendarDirection?: "horizontal" | "vertical"
    from?: string
    to?: string
    // ── Stream chart ──
    /** Keys for stream layers (must match data keys) */
    streamKeys?: string[]
    /** Offset type for stream */
    streamOffsetType?: "wiggle" | "silhouette" | "expand" | "diverging" | "none"
    // ── Treemap ──
    /** Identity accessor for treemap nodes */
    identity?: string
    /** Value accessor for treemap nodes */
    treemapValue?: string
    // ── Waffle ──
    /** Total value for waffle (sum of data values) */
    waffleTotal?: number
    /** Number of columns in waffle grid */
    waffleColumns?: number
    /** Row height for waffle rows */
    waffleRows?: number
    // ── Radar ──
    /** Keys for radar indices */
    radarKeys?: string[]
    /** IndexBy for radar */
    radarIndexBy?: string
}

export interface AnalyticsPanelItem {
    id: string
    title?: string
    colSpan?: 1 | 2 | 3
    rowSpan?: 1 | 2
    content:
        | { type: "stat-card"; config: StatCardConfig }
        | { type: "bar-chart" | "pie-chart" | "line-chart" | "calendar-heatmap" | "stream-chart" | "treemap-chart" | "waffle-chart" | "radar-chart"; config: ChartConfig }
        | { type: "custom"; render: React.ReactNode }
}

export interface AnalyticsSection {
    id: string
    /** How many columns to span (default 1). Requires grid layout — only used when any section in the tab has colSpan > 1 */
    colSpan?: number
    content:
        | { type: "stat-card"; config: StatCardConfig }
        | { type: "bar-chart" | "pie-chart" | "line-chart" | "calendar-heatmap" | "stream-chart" | "treemap-chart" | "waffle-chart" | "radar-chart"; config: ChartConfig }
        | { type: "custom"; render: React.ReactNode }
}

export interface AnalyticsColumn {
    id: string
    sections: AnalyticsSection[]
    weight?: number
}

export interface AnalyticsTab {
    value: string
    label: string
    icon?: LucideIcon
    badge?: string | number
    description?: string
    /** Columnar layout (recommended) — each col splits available height evenly across sections */
    columns?: AnalyticsColumn[]
    /** Legacy grid layout — kept for backwards compatibility */
    panels?: AnalyticsPanelItem[]
}

export type Granularity = "day" | "month" | "year"

interface AnalyticsPanelProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entityName: string
    tabs: AnalyticsTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
    /** Data segmentation — date range is managed internally via presets */
    granularity?: Granularity
    onGranularityChange?: (g: Granularity) => void
    /** Override date range; null removes filter */
    dateRange?: { from: string; to: string } | null
    onDateRangeChange?: (range: { from: string; to: string } | null) => void
    /** Card account filter — synced with SmartSearchBar card filter */
    cardAccounts?: Array<{ id: number; name: string; currency: string }>
    cardAccountId?: number | null
    onCardAccountChange?: (id: number) => void
}

const SEGMENTATION_PRESETS: { label: string; key: string; range: () => { from: string; to: string } | null }[] = [
    { label: "Todo", key: "all", range: () => null },
    {
        label: "Este Mes", key: "month",
        range: () => {
            const d = new Date()
            return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0], to: d.toISOString().split("T")[0] }
        },
    },
    {
        label: "Trimestre", key: "quarter",
        range: () => {
            const d = new Date()
            const from = new Date(d)
            from.setMonth(from.getMonth() - 3)
            return { from: from.toISOString().split("T")[0], to: d.toISOString().split("T")[0] }
        },
    },
    {
        label: "Año", key: "year",
        range: () => {
            const d = new Date()
            const from = new Date(d)
            from.setFullYear(from.getFullYear() - 1)
            return { from: from.toISOString().split("T")[0], to: d.toISOString().split("T")[0] }
        },
    },
]

function isDateRangeEqual(a?: { from: string; to: string } | null, b?: { from: string; to: string } | null): boolean {
    if (!a && !b) return true
    if (!a || !b) return false
    return a.from === b.from && a.to === b.to
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

// ── Internal panel/chart renderers ────────────────────────────

function PanelItem({ panel }: { panel: AnalyticsPanelItem }) {
    const colSpan = panel.colSpan ?? 1
    const rowSpan = panel.rowSpan ?? 1

    const gridStyle: React.CSSProperties = {
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
    }

    if (panel.content.type === "stat-card") {
        const card = panel.content.config
        const effectiveVariant = card.variant === "fill" ? "fill"
            : card.variant === "chart" ? "chart"
            : card.variant === "metric-chart" ? "metric-chart"
            : card.variant === "compact" || card.variant === "minimal" ? card.variant
            : undefined
        return (
            <div className="flex flex-col flex-1" style={gridStyle}>
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
                    variant={effectiveVariant}
                    valueSize={card.valueSize}
                    trend={card.trend}
                    href={card.href}
                    onClick={card.onClick}
                    active={card.active}
                    loading={card.loading}
                    chart={card.chart ? (
                        <ChartRenderer type={card.chart.type} config={card.chart.config} />
                    ) : undefined}
                />
            </div>
        )
    }

    return (
        <div
            className="flex flex-col min-h-0 flex-1"
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
                <div className="flex-1 min-h-0 flex flex-col">
                    <ChartRenderer type={panel.content.type} config={panel.content.config} />
                </div>
            )}
        </div>
    )
}

function SectionItem({ section }: { section: AnalyticsSection }) {
    if (section.content.type === "stat-card") {
        const card = section.content.config
        const effectiveVariant = card.variant === "fill" ? "fill"
            : card.variant === "chart" ? "chart"
            : card.variant === "metric-chart" ? "metric-chart"
            : card.variant === "compact" || card.variant === "minimal" ? card.variant
            : undefined
        return (
            <div className="flex flex-col flex-1 min-h-0">
                <StatCard
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    accent={card.accent}
                    subtext={card.subtext}
                    variant={effectiveVariant}
                    valueSize={card.valueSize}
                    trend={card.trend}
                    href={card.href}
                    onClick={card.onClick}
                    active={card.active}
                    loading={card.loading}
                    chart={card.chart ? (
                        <ChartRenderer type={card.chart.type} config={card.chart.config} />
                    ) : undefined}
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {section.content.type === "custom" ? (
                <div className="flex-1">{section.content.render}</div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                    <ChartRenderer type={section.content.type} config={section.content.config} />
                </div>
            )}
        </div>
    )
}

function getCssChartColors(): string[] {
    if (typeof window === "undefined") return ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
    const style = getComputedStyle(document.documentElement)
    const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"]
    return vars.map((v) => {
        const val = style.getPropertyValue(v).trim()
        return val || "#000"
    })
}

const nivoTheme = {
    axis: {
        ticks: {
            text: { fontSize: 10, fontFamily: 'inherit', fill: 'hsl(var(--muted-foreground))' },
            line: { strokeWidth: 0 },
        },
    },
    grid: {
        line: { stroke: 'transparent', strokeWidth: 0 },
    },
    labels: {
        text: { fontSize: 10, fontFamily: 'inherit' },
    },
    legends: {
        text: { fontSize: 10, fontFamily: 'inherit' },
    },
}

function ChartRenderer({
    type,
    config,
}: {
    type: "bar-chart" | "pie-chart" | "line-chart" | "calendar-heatmap" | "stream-chart" | "treemap-chart" | "waffle-chart" | "radar-chart"
    config: ChartConfig
}) {
    const chartColors = React.useMemo(() => getCssChartColors(), [])
    const colors = (config.colors ?? chartColors) as any
    const showLegend = config.showLegend ?? true
    const pit = config.compact ? 4 : 16
    const legendPad = showLegend && !config.compact ? 24 : 0
    const m = config.margin ?? (config.compact ? { top: pit, right: pit, bottom: pit, left: pit } : undefined)
    const overlay = config.lineOverlay
    const _colors = Array.isArray(colors) ? colors : (chartColors as string[])
    const legendItems = overlay && showLegend ? [
        ...(config.keys ?? []).map((key, i) => ({
            id: key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            color: _colors[i % _colors.length],
        })),
        {
            id: "line",
            label: overlay.label,
            color: overlay.color ?? "#f59e0b",
        },
    ] : undefined

    const axes = config.compact
        ? { axisBottom: null, axisLeft: null }
        : {
            axisBottom: {
                tickSize: 0,
                tickPadding: 8,
                legend: config.axisBottomLegend,
                legendPosition: 'middle' as const,
                legendOffset: 36,
            },
            axisLeft: {
                tickSize: 0,
                tickPadding: 8,
                format: config.valueFormat ?? "~s",
                legend: config.axisLeftLegend,
                legendPosition: 'middle' as const,
                legendOffset: -48,
            },
        }

    const sharedProps = {
        colors,
        enableGridX: config.enableGridX ?? false,
        enableGridY: config.enableGridY ?? false,
        theme: nivoTheme,
        legends: showLegend ? (legendItems ? [{
            data: legendItems,
            dataFrom: "keys" as const,
            anchor: "top" as const,
            direction: "row" as const,
            translateY: -22,
            itemWidth: 80,
            itemHeight: 14,
            itemsSpacing: 12,
            symbolSize: 8,
            symbolShape: "circle" as const,
        }] : [{
            dataFrom: (config.legendDataFrom ?? "keys") as "keys" | "indexes",
            anchor: "top" as const,
            direction: "row" as const,
            translateY: -22,
            itemWidth: 80,
            itemHeight: 14,
            itemsSpacing: 12,
            symbolSize: 8,
            symbolShape: "circle" as const,
        }]) : [],
    }

    const [hoverPoint, setHoverPoint] = React.useState<{ x: number; y: number; value: number; label: string } | null>(null)
    const chartRef = React.useRef<HTMLDivElement>(null)

    return (
        <div ref={chartRef} className="flex-1 min-h-0 w-full relative">
            {type === "bar-chart" && (
                <ResponsiveBar
                    data={config.data as any}
                    keys={config.keys ?? []}
                    indexBy={config.indexBy ?? "id"}
                    padding={0.15}
                    borderRadius={config.borderRadius ?? 4}
                    margin={m ?? { top: pit + legendPad, right: pit, bottom: 28, left: 36 }}
                    valueFormat={config.valueFormat}
                    enableLabel={config.enableLabels ?? false}
                    layers={overlay ? [
                        'grid' as const,
                        'axes' as const,
                        'bars' as const,
                        'markers' as const,
                        ({ bars, yScale, margin: mgn }: any) => {
                            const lineKey = overlay.dataKey
                            const lineColor = overlay.color ?? '#f59e0b'
                            const indexMap = new Map<string, { x: number; y: number; value: number }>()
                            for (const bar of bars) {
                                const idx = bar.data.indexValue ?? bar.index
                                if (indexMap.has(idx)) continue
                                const data = bar.data.data ?? bar.data
                                const val = Number(data[lineKey]) ?? 0
                                if (val > 0 || val === 0) {
                                    indexMap.set(idx, {
                                        x: bar.x + bar.width / 2,
                                        y: yScale(val),
                                        value: val,
                                    })
                                }
                            }
                            const points = Array.from(indexMap.values())
                                .sort((a: any, b: any) => a.x - b.x)

                            return (
                                <g>
                                    {points.length >= 2 && (
                                        <path
                                            d={points.map((p: any, i: number) =>
                                                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                            ).join(' ')}
                                            stroke={lineColor}
                                            strokeWidth={2.5}
                                            fill="none"
                                            strokeLinejoin="round"
                                        />
                                    )}
                                    {points.map((p: any, i: number) => (
                                        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={lineColor} stroke="white" strokeWidth={1.5} />
                                    ))}
                                    {points.map((p: any, i: number) => (
                                        <circle
                                            key={`hit-${i}`}
                                            cx={p.x} cy={p.y} r={10}
                                            fill="transparent"
                                            style={{ cursor: 'pointer' }}
                                            onMouseEnter={(e) => {
                                                const rect = chartRef.current?.getBoundingClientRect()
                                                if (rect) {
                                                    setHoverPoint({
                                                        x: e.clientX - rect.left,
                                                        y: e.clientY - rect.top,
                                                        value: p.value,
                                                        label: overlay.label,
                                                    })
                                                }
                                            }}
                                            onMouseLeave={() => setHoverPoint(null)}
                                        />
                                    ))}
                                </g>
                            )
                        },
                        'legends' as const,
                        'annotations' as const,
                    ] : undefined}
                    {...axes}
                    {...sharedProps}
                />
            )}
            {type === "pie-chart" && (
                <ResponsivePie
                    data={config.data as any}
                    innerRadius={config.innerRadius ?? 0}
                    padAngle={0}
                    cornerRadius={0}
                    borderWidth={2}
                    borderColor={{ theme: "background" }}
                    enableArcLinkLabels={config.compact ? false : (config.enableLabels ?? false)}
                    arcLinkLabelsOffset={4}
                    arcLinkLabelsThickness={1}
                    arcLinkLabelsTextOffset={4}
                    arcLinkLabelsTextColor={{ theme: "labels.text.fill" }}
                    enableArcLabels={config.enableLabels ?? true}
                    arcLabel={config.arcLabel ?? "id"}
                    arcLabelsRadiusOffset={0.55}
                    arcLabelsSkipAngle={8}
                    margin={m ?? { top: pit + legendPad, right: pit, bottom: pit, left: pit }}
                    {...sharedProps}
                />
            )}
            {type === "line-chart" && (
                <ResponsiveLine
                    data={config.data as any}
                    margin={m ?? { top: pit + legendPad, right: pit, bottom: 28, left: 36 }}
                    curve="linear"
                    lineWidth={config.compact ? 3 : 4}
                    pointSize={config.compact ? 0 : 4}
                    pointBorderWidth={0}
                    enableArea={config.enableArea ?? false}
                    areaOpacity={0.12}
                    enablePoints={!config.compact}
                    enablePointLabel={config.enableLabels ?? false}
                    {...axes}
                    {...sharedProps}
                />
            )}
            {type === "calendar-heatmap" && (
                <ResponsiveCalendar
                    data={config.data as any}
                    margin={m ?? { top: pit, right: pit, bottom: pit, left: pit }}
                    from={config.from ?? ((config.data as any[])?.[0]?.day) ?? new Date().toISOString().split("T")[0]}
                    to={config.to ?? ((config.data as any[])?.[(config.data as any[])?.length - 1]?.day) ?? new Date().toISOString().split("T")[0]}
                    direction={config.calendarDirection ?? "horizontal"}
                    emptyColor="hsl(var(--muted))"
                    colors={["hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"] as any}
                    monthBorderColor="hsl(var(--border))"
                    dayBorderColor="hsl(var(--background))"
                    dayBorderWidth={2}
                    theme={nivoTheme}
                    legends={config.showLegend ? [{
                        anchor: "bottom-right" as const,
                        direction: "row" as const,
                        translateY: 28,
                        itemWidth: 40,
                        itemHeight: 14,
                        itemDirection: "left-to-right" as const,
                        itemsSpacing: 6,
                        symbolSize: 8,
                        itemCount: 4,
                    }] : []}
                />
            )}
            {type === "stream-chart" && (
                <ResponsiveStream
                    data={config.data as any}
                    keys={config.streamKeys ?? []}
                    margin={m ?? { top: pit + legendPad, right: pit, bottom: 28, left: 36 }}
                    offsetType={config.streamOffsetType ?? "none"}
                    curve="natural"
                    colors={{ scheme: "nivo" } as any}
                    borderWidth={0}
                    enableGridX={config.enableGridX ?? false}
                    enableGridY={config.enableGridY ?? false}
                    axisBottom={{
                        tickSize: 0,
                        tickPadding: 8,
                        legend: config.axisBottomLegend,
                        legendPosition: "middle" as const,
                        legendOffset: 36,
                    }}
                    axisLeft={config.compact ? null : {
                        tickSize: 0,
                        tickPadding: 8,
                        format: config.valueFormat ?? "~s",
                    }}
                    theme={nivoTheme}
                    legends={config.showLegend ? [{
                        anchor: "top" as const,
                        direction: "row" as const,
                        translateY: -22,
                        itemWidth: 80,
                        itemHeight: 14,
                        itemsSpacing: 12,
                        symbolSize: 8,
                        symbolShape: "circle" as const,
                    }] : []}
                />
            )}
            {type === "treemap-chart" && (
                <ResponsiveTreeMap
                    data={config.data as any}
                    identity={config.identity ?? "id"}
                    value={config.treemapValue ?? "value"}
                    margin={m ?? { top: pit, right: pit, bottom: pit, left: pit }}
                    labelSkipSize={16}
                    borderWidth={2}
                    borderColor={{ theme: "background" }}
                    colors={{ scheme: "nivo" } as any}
                    theme={nivoTheme}
                    leavesOnly={true}
                    enableLabel={config.enableLabels ?? true}
                />
            )}
            {type === "waffle-chart" && (
                <ResponsiveWaffle
                    data={config.data as any}
                    total={config.waffleTotal ?? 100}
                    columns={config.waffleColumns ?? 14}
                    rows={config.waffleRows ?? 8}
                    margin={m ?? { top: pit, right: pit, bottom: pit, left: pit }}
                    colors={{ scheme: "nivo" } as any}
                    borderWidth={2}
                    borderColor={{ theme: "background" }}
                    theme={nivoTheme}
                    valueFormat={config.valueFormat ?? " >-.0f"}
                    legends={config.showLegend ? [{
                        anchor: "bottom" as const,
                        direction: "row" as const,
                        translateY: 28,
                        itemWidth: 60,
                        itemHeight: 14,
                        itemsSpacing: 8,
                        symbolSize: 8,
                    }] : []}
                />
            )}
            {type === "radar-chart" && (
                <ResponsiveRadar
                    data={config.data as any}
                    keys={config.radarKeys ?? []}
                    indexBy={config.radarIndexBy ?? "category"}
                    margin={m ?? { top: 40, right: 60, bottom: 40, left: 60 }}
                    curve="catmullRomClosed"
                    borderWidth={2}
                    borderColor={{ from: "color" }}
                    gridLevels={3}
                    gridShape="circular"
                    gridLabelOffset={12}
                    theme={nivoTheme}
                    colors={{ scheme: "nivo" } as any}
                    fillOpacity={0.15}
                    blendMode="multiply"
                    enableDotLabel={config.enableLabels ?? true}
                    legends={config.showLegend ? [{
                        anchor: "top-left" as const,
                        direction: "column" as const,
                        translateX: -40,
                        translateY: -20,
                        itemWidth: 80,
                        itemHeight: 20,
                        itemsSpacing: 8,
                        symbolSize: 8,
                    }] : []}
                />
            )}

            {hoverPoint && (
                <div
                    className="pointer-events-none absolute z-10 bg-popover text-popover-foreground text-[11px] font-bold px-2.5 py-1.5 rounded-md shadow-sm border whitespace-nowrap"
                    style={{
                        left: hoverPoint.x,
                        top: hoverPoint.y - 10,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    {hoverPoint.label}: ${Number(hoverPoint.value).toLocaleString("es-CL")}
                </div>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────

export function AnalyticsPanel({
    open,
    onOpenChange,
    entityName,
    tabs,
    activeTab: activeTabProp,
    onTabChange,
    granularity,
    onGranularityChange,
    dateRange: dateRangeProp,
    onDateRangeChange,
    cardAccounts,
    cardAccountId,
    onCardAccountChange,
}: AnalyticsPanelProps) {
    const [internalTab, setInternalTab] = useState(tabs[0]?.value ?? "")

    const currentTab = activeTabProp ?? internalTab
    const handleTabChange = onTabChange ?? setInternalTab

    const activePreset = useMemo(() => {
        const preset = SEGMENTATION_PRESETS.find(p => isDateRangeEqual(p.range(), dateRangeProp))
        return preset?.key ?? "custom"
    }, [dateRangeProp])

    function handlePresetClick(preset: (typeof SEGMENTATION_PRESETS)[number]) {
        onDateRangeChange?.(preset.range())
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={`Análisis · ${entityName}`}
            icon={<LayoutDashboard />}
            side="bottom"
            defaultSize="70vh"
        >
            <UnderlineTabs
                items={tabs.map((t) => ({
                    value: t.value,
                    label: t.label,
                    icon: t.icon,
                    badge: t.badge,
                }))}
                value={currentTab}
                onValueChange={handleTabChange}
                orientation="horizontal"
                variant="underline"
                className="flex-1 flex flex-col overflow-hidden"
                headerClassName="justify-center"
                contentClassName="flex flex-col"
            >
                {tabs.map((tab) => (
                    <UnderlineTabsContent
                        key={tab.value}
                        value={tab.value}
                        className="flex-1 flex flex-col"
                    >
                        <div className="p-6 flex flex-col min-h-0 h-full">
                            {tab.description && (
                                <p className="text-xs text-muted-foreground/70 font-medium mb-4 shrink-0">
                                    {tab.description}
                                </p>
                            )}
                            {tab.columns?.length ? (() => {
                                const hasColSpan = tab.columns.some(col =>
                                    col.sections.some(s => (s.colSpan ?? 1) > 1)
                                )

                                if (!hasColSpan) {
                                    return (
                                        <div className="flex gap-4 flex-1 min-h-0">
                                            {tab.columns.map((col) => (
                                                <div
                                                    key={col.id}
                                                    className="flex flex-col gap-4 min-h-0"
                                                    style={{ flex: col.weight ?? 1 }}
                                                >
                                                    {col.sections.map((section) => (
                                                        <div key={section.id} className="flex-1 min-h-0 flex flex-col">
                                                            <SectionItem section={section} />
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }

                                return (
                                    <div
                                        className="grid gap-4 flex-1 min-h-0"
                                        style={{
                                            gridTemplateColumns: tab.columns.map(c => `${c.weight ?? 1}fr`).join(' '),
                                            gridAutoRows: 'minmax(0, 1fr)',
                                        }}
                                    >
                                        {tab.columns.flatMap(col =>
                                            col.sections.map(section => ({ section }))
                                        ).map(({ section }) => (
                                            <div
                                                key={section.id}
                                                className="flex flex-col min-h-0"
                                                style={{ gridColumn: `span ${section.colSpan ?? 1}` }}
                                            >
                                                <SectionItem section={section} />
                                            </div>
                                        ))}
                                    </div>
                                )
                            })() : (
                                <div className="grid grid-cols-3 gap-4 flex-1 min-h-0" style={{ gridAutoRows: 'minmax(min-content, 1fr)' }}>
                                    {tab.panels?.map((panel) => (
                                        <PanelItem key={panel.id} panel={panel} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </UnderlineTabsContent>
                ))}
            </UnderlineTabs>
            {(cardAccounts && cardAccounts.length > 0 && onCardAccountChange) || (granularity && onGranularityChange) ? (
                <div className="flex items-center justify-center gap-5 px-6 py-2 border-t border-border shrink-0 flex-wrap">
                    {cardAccounts && cardAccounts.length > 0 && onCardAccountChange && (
                        <>
                            <span className="text-xs text-muted-foreground font-medium">Tarjeta:</span>
                            <Select
                                value={String(cardAccountId ?? cardAccounts[0]?.id ?? '')}
                                onValueChange={(v) => onCardAccountChange(Number(v))}
                            >
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue placeholder="Seleccionar tarjeta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cardAccounts.map((acct) => (
                                        <SelectItem key={acct.id} value={String(acct.id)} className="text-xs">
                                            {acct.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                    {granularity && onGranularityChange && (
                        <>
                            <span className="text-xs text-muted-foreground font-medium">Rango de fechas:</span>
                            <Select
                                value={activePreset}
                                onValueChange={(key) => {
                                    const preset = SEGMENTATION_PRESETS.find(p => p.key === key)
                                    if (preset) handlePresetClick(preset)
                                }}
                            >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEGMENTATION_PRESETS.map((preset) => (
                                        <SelectItem key={preset.key} value={preset.key} className="text-xs">
                                            {preset.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground font-medium">Agrupar por:</span>
                            <Select
                                value={granularity}
                                onValueChange={(v) => onGranularityChange(v as "day" | "month" | "year")}
                            >
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day" className="text-xs">Día</SelectItem>
                                    <SelectItem value="month" className="text-xs">Mes</SelectItem>
                                    <SelectItem value="year" className="text-xs">Año</SelectItem>
                                </SelectContent>
                            </Select>
                        </>
                    )}
                </div>
            ) : null}
        </Drawer>
    )
}
