"use client"

import React from "react"
import type { AnalyticsColumn, AnalyticsSection as AnalyticsSectionType, ChartConfig } from "./types"
import { StatCard, ChartLegend } from "@/components/shared"
import { AnalyticsChart } from "./AnalyticsChart"
import { getCssChartColors } from "./nivo-theme"

function extractLegendItems(chart: ChartConfig): Array<{ label: string; color?: string }> {
    const palette = getCssChartColors(chart.type === "pie-chart" ? "pie" : undefined)

    switch (chart.type) {
        case "bar-chart": {
            const items = chart.keys.map((key, i) => ({
                label: key.charAt(0).toUpperCase() + key.slice(1),
                color: palette[i % palette.length],
            }))
            if (chart.lineOverlay) {
                items.push({
                    label: chart.lineOverlay.label,
                    color: chart.lineOverlay.color ?? "#f59e0b",
                })
            }
            return items
        }
        case "line-chart":
            return chart.data.map((series, i) => ({
                label: series.id,
                color: palette[i % palette.length],
            }))
        case "pie-chart":
            return chart.data.map((slice, i) => ({
                label: slice.id,
                color: slice.color ?? palette[i % palette.length],
            }))
    }
}

function SectionRenderer({ section }: { section: AnalyticsSectionType }) {
    const content = section.content

    if (content.type === "stat-card") {
        const card = content.config
        const effectiveVariant = card.variant === "fill" ? "fill"
            : card.variant === "chart" ? "chart"
            : card.variant === "metric-chart" ? "metric-chart"
            : card.variant === "compact" || card.variant === "minimal" ? card.variant
            : undefined

        return (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                    chart={card.chart ? <AnalyticsChart {...card.chart} /> : undefined}
                    chartLegend={card.chart?.preset === "card"
                        ? <ChartLegend items={extractLegendItems(card.chart)} />
                        : undefined
                    }
                />
            </div>
        )
    }

    if (content.type === "custom") {
        return (
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 flex flex-col">{content.render}</div>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 flex flex-col">
                <AnalyticsChart {...content} />
            </div>
        </div>
    )
}

function ColRenderer({ column }: { column: AnalyticsColumn }) {
    const hasColSpan = column.sections.some((s) => (s.colSpan ?? 1) > 1)

    if (!hasColSpan) {
        return (
            <div className="flex flex-col gap-4 min-h-0" style={{ flex: column.weight ?? 1 }}>
                {column.sections.map((section) => (
                    <div key={section.id} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <SectionRenderer section={section} />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div
            className="grid gap-4 flex-1 min-h-0"
            style={{
                gridTemplateColumns: `${column.weight ?? 1}fr`,
                gridAutoRows: "minmax(0, 1fr)",
            }}
        >
            {column.sections.map((section) => (
                <div
                    key={section.id}
                    className="flex flex-col min-h-0 overflow-hidden"
                    style={{ gridColumn: `span ${section.colSpan ?? 1}` }}
                >
                    <SectionRenderer section={section} />
                </div>
            ))}
        </div>
    )
}

interface LayoutProps {
    columns: AnalyticsColumn[]
}

export function AnalyticsLayout({ columns }: LayoutProps) {
    const hasColSpan = columns.some((col) =>
        col.sections.some((s) => (s.colSpan ?? 1) > 1)
    )

    if (!hasColSpan) {
        return (
            <div className="flex gap-4 flex-1 min-h-0">
                {columns.map((col) => (
                    <ColRenderer key={col.id} column={col} />
                ))}
            </div>
        )
    }

    return (
        <div
            className="grid gap-4 flex-1 min-h-0"
            style={{
                gridTemplateColumns: columns.map((c) => `${c.weight ?? 1}fr`).join(" "),
                gridAutoRows: "minmax(0, 1fr)",
            }}
        >
            {columns.flatMap((col) => col.sections.map((section) => ({ section }))).map(({ section }) => (
                <div
                    key={section.id}
                    className="flex flex-col min-h-0"
                    style={{ gridColumn: `span ${section.colSpan ?? 1}` }}
                >
                    <SectionRenderer section={section} />
                </div>
            ))}
        </div>
    )
}
