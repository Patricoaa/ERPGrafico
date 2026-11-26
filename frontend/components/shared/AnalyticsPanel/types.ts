"use client"

import type { LucideIcon } from "lucide-react"
import type { MetricProps } from "../Metric"
import type { ChartCardProps } from "../ChartCard"

// ── Granularity ──
export type Granularity = "day" | "month" | "year"

// ── Section content (ADR-0149) ──
//
// A section is a `Metric` (one figure), a `ChartCard` (a chart with header) or a bare chart.
// Props mirror the components so a section reads like the JSX it renders.

/** Config of a `metric` section: the props of `Metric`. */
export type MetricSectionConfig = MetricProps

/** Config of a `chart-card` section: the props of `ChartCard`, with the chart as data. */
export interface ChartCardSectionConfig extends Omit<ChartCardProps, "children" | "legend" | "fill"> {
    chart: ChartConfig
}

// ── Drill-down (ADR-0158 §11) ──

/** The filter a click on a bar or a slice applies to the collection. */
export interface AnalyticsDrillDownFilter {
    /** Server / URL param of a filter or search scope the collection knows (`customer_name`). */
    param: string
    value: string
}

/**
 * Makes a bar or pie chart drillable: a click applies `param` to the collection. The value is the
 * clicked category (pie `id`, bar `indexBy` value), translated through `values` when the chart shows
 * labels ("Entregado" → `DELIVERED`). With `values`, an unmapped category is not clickable.
 */
export interface ChartDrillDown {
    param: string
    values?: Readonly<Record<string, string>>
}

// ── Chart configs (discriminated by type, no `any`) ──

export interface BarChartConfig {
    type: "bar-chart"
    preset?: "card"
    data: Record<string, string | number>[]
    keys: string[]
    indexBy: string
    valueFormat?: string
    showLegend?: boolean
    enableGridY?: boolean
    borderRadius?: number
    padding?: number
    lineOverlay?: { dataKey: string; label: string; color?: string }
    axisBottomLegend?: string
    axisLeftLegend?: string
    compact?: boolean
    drillDown?: ChartDrillDown
}

export interface LineChartConfig {
    type: "line-chart"
    preset?: "card"
    data: Array<{ id: string; data: Array<{ x: string | number; y: number }> }>
    enableArea?: boolean
    showLegend?: boolean
    valueFormat?: string
    compact?: boolean
    axisBottomLegend?: string
    axisLeftLegend?: string
}

export interface PieChartConfig {
    type: "pie-chart"
    preset?: "card"
    data: Array<{ id: string; value: number; color?: string }>
    innerRadius?: number
    showLegend?: boolean
    enableLabels?: boolean
    enableArcLinkLabels?: boolean
    compact?: boolean
    arcLabel?: (d: { id: string; value: number }) => string
    valueFormat?: "currency" | "number"
    centerLabel?: { value: string | number; label?: string }
    drillDown?: ChartDrillDown
}

export interface RadarChartConfig {
    type: "radar-chart"
    preset?: "card"
    data: Record<string, string | number>[]
    keys: string[]
    indexBy: string
    maxValue?: "auto" | number
    showLegend?: boolean
    compact?: boolean
    valueFormat?: string
}

export interface FunnelChartConfig {
    type: "funnel-chart"
    preset?: "card"
    data: { id: string | number; value: number; label?: string; color?: string }[]
    valueFormat?: string
    direction?: "horizontal" | "vertical"
    enableLabel?: boolean
}

export type ChartConfig = BarChartConfig | LineChartConfig | PieChartConfig | RadarChartConfig | FunnelChartConfig

// ── Layout types ──

export interface AnalyticsSection {
    id: string
    colSpan?: number
    /** If false, section takes natural height instead of filling remaining space. Defaults to true. */
    fillRemaining?: boolean
    content:
        | { type: "metric"; config: MetricSectionConfig }
        | { type: "chart-card"; config: ChartCardSectionConfig }
        | { type: "custom"; render: React.ReactNode }
        | ChartConfig
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
    columns?: AnalyticsColumn[]
    gridRows?: string
}

export interface AnalyticsPanelContentProps {
    entityName: string
    tabs: AnalyticsTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
    granularity?: Granularity
    onGranularityChange?: (value: Granularity) => void
    /** Drillable charts call this. Inside `Collection.Analytics` it is provided: the filter is applied and the modal closes. */
    onDrillDown?: (filter: AnalyticsDrillDownFilter) => void
}


