"use client"

import React, { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { Drawer } from "./Drawer"
import { StatCard } from "./StatCard"
import { UnderlineTabs, UnderlineTabsContent } from "./UnderlineTabs"
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

export interface HubPanel {
    id: string
    title?: string
    colSpan?: 1 | 2 | 3
    rowSpan?: 1 | 2
    content:
        | { type: "stat-card"; config: StatCardConfig }
        | { type: "bar-chart" | "pie-chart" | "line-chart"; config: ChartConfig }
        | { type: "custom"; render: React.ReactNode }
}

export interface HubTab {
    value: string
    label: string
    icon?: LucideIcon
    badge?: string | number
    description?: string
    panels: HubPanel[]
}

interface EntityHubScreenProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entityName: string
    tabs: HubTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
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

function PanelItem({ panel }: { panel: HubPanel }) {
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

export function EntityHubScreen({
    open,
    onOpenChange,
    entityName,
    tabs,
    activeTab: activeTabProp,
    onTabChange,
}: EntityHubScreenProps) {
    const [internalTab, setInternalTab] = useState(tabs[0]?.value ?? "")

    const currentTab = activeTabProp ?? internalTab
    const handleTabChange = onTabChange ?? setInternalTab

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={`Hub · ${entityName}`}
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
            >
                {tabs.map((tab) => (
                    <UnderlineTabsContent
                        key={tab.value}
                        value={tab.value}
                        className="flex-1 overflow-y-auto"
                    >
                        <div className="p-6 flex flex-col min-h-0">
                            {tab.description && (
                                <p className="text-xs text-muted-foreground/70 font-medium mb-4">
                                    {tab.description}
                                </p>
                            )}
                            <div className="grid grid-cols-3 gap-4 flex-1 min-h-0" style={{ gridAutoRows: 'minmax(min-content, 1fr)' }}>
                                {tab.panels.map((panel) => (
                                    <PanelItem key={panel.id} panel={panel} />
                                ))}
                            </div>
                        </div>
                    </UnderlineTabsContent>
                ))}
            </UnderlineTabs>
        </Drawer>
    )
}
