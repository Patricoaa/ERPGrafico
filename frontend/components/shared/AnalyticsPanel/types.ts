"use client"

import type { LucideIcon } from "lucide-react"

// ── Granularity ──
export type Granularity = "day" | "month" | "year"

// ── Accent ──
export type Accent = "primary" | "info" | "success" | "warning" | "destructive" | "accent" | "muted"

// ── StatCardConfig ──
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
    chart?: ChartConfig
    tooltip?: string
    comparison?: {
        current: number
        previous?: number
        showComparison?: boolean
        isPercentage?: boolean
        alreadyPercent?: boolean
        isCurrency?: boolean
        decimals?: number
        inverse?: boolean
    }
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
    content:
        | { type: "stat-card"; config: StatCardConfig }
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
}

export interface AnalyticsPanelProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entityName: string
    tabs: AnalyticsTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
    granularity?: Granularity
    onGranularityChange?: (value: Granularity) => void
}

export interface AnalyticsPanelContentProps {
    entityName: string
    tabs: AnalyticsTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
    granularity?: Granularity
    onGranularityChange?: (value: Granularity) => void
}

export type AnalyticsPanelConfig = {
    onClick?: () => void
    screen?: {
        entityName: string
        tabs: AnalyticsTab[]
        activeTab?: string
        onTabChange?: (value: string) => void
        granularity?: Granularity
        onGranularityChange?: (value: Granularity) => void
    }
}


