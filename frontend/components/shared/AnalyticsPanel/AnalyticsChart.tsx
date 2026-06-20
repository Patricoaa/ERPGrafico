"use client"

import React from "react"
import dynamic from "next/dynamic"
import type { BarChartConfig, LineChartConfig, PieChartConfig } from "./types"
import { nivoTheme, getCssChartColors } from "./nivo-theme"
import { Skeleton } from "@/components/ui/skeleton"

const LazyResponsiveBar = dynamic(() => import("@nivo/bar").then((m) => ({ default: m.ResponsiveBar })), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
})

const LazyResponsiveLine = dynamic(() => import("@nivo/line").then((m) => ({ default: m.ResponsiveLine })), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
})

const LazyResponsivePie = dynamic(() => import("@nivo/pie").then((m) => ({ default: m.ResponsivePie })), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
})

type Props = BarChartConfig | LineChartConfig | PieChartConfig

const defaultLegend = {
    anchor: "top" as const,
    direction: "row" as const,
    translateY: -22,
    itemWidth: 80,
    itemHeight: 14,
    itemsSpacing: 12,
    symbolSize: 8,
    symbolShape: "circle" as const,
}

function BarChartRenderer(props: BarChartConfig) {
    const chartColors = React.useMemo(() => getCssChartColors(), [])
    const pit = props.compact ? 4 : 16
    const showLegend = props.showLegend ?? true
    const legendPad = showLegend && !props.compact ? 24 : 0
    const axisBottomPad = props.axisBottomLegend ? 20 : 0
    const axisLeftPad = props.axisLeftLegend ? 96 : 0
    const axes = props.compact
        ? { axisBottom: null, axisLeft: null }
        : {
            axisBottom: {
                tickSize: 0,
                tickPadding: 8,
                legend: props.axisBottomLegend,
                legendPosition: "middle" as const,
                legendOffset: 36,
            },
            axisLeft: {
                tickSize: 0,
                tickPadding: 8,
                format: props.valueFormat ?? "$,.0f",
                legend: props.axisLeftLegend,
                legendPosition: "middle" as const,
                legendOffset: -140,
            },
        }

    const legendItems = props.lineOverlay && showLegend ? [
        ...(props.keys ?? []).map((key, i) => ({
            id: key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            color: chartColors[i % chartColors.length],
        })),
        {
            id: "line",
            label: props.lineOverlay.label,
            color: props.lineOverlay.color ?? "#f59e0b",
        },
    ] : undefined

    const barLegends = legendItems
        ? [{ data: legendItems, dataFrom: "keys" as const, ...defaultLegend }]
        : showLegend
            ? [{ dataFrom: "keys" as const, ...defaultLegend }]
            : []

    return (
        <div className="flex-1 min-h-0 w-full relative">
            <LazyResponsiveBar
                data={props.data}
                keys={props.keys}
                indexBy={props.indexBy}
                padding={0.15}
                borderRadius={props.borderRadius ?? 4}
                margin={{ top: pit + legendPad, right: pit, bottom: 28 + axisBottomPad, left: 64 + axisLeftPad }}
                valueFormat={props.valueFormat}
                enableLabel={false}
                colors={chartColors}
                enableGridX={false}
                enableGridY={props.enableGridY ?? false}
                theme={nivoTheme}
                legends={barLegends}
                {...axes}
            />
        </div>
    )
}

function LineChartRenderer(props: LineChartConfig) {
    const chartColors = React.useMemo(() => getCssChartColors(), [])
    const pit = props.compact ? 4 : 16
    const showLegend = props.showLegend ?? true
    const legendPad = showLegend && !props.compact ? 24 : 0
    const axisBottomPad = props.axisBottomLegend ? 20 : 0
    const axisLeftPad = props.axisLeftLegend ? 96 : 0
    const axes = props.compact
        ? { axisBottom: null, axisLeft: null }
        : {
            axisBottom: {
                tickSize: 0,
                tickPadding: 8,
                legend: props.axisBottomLegend,
                legendPosition: "middle" as const,
                legendOffset: 36,
            },
            axisLeft: {
                tickSize: 0,
                tickPadding: 8,
                format: props.valueFormat ?? "$,.0f",
                legend: props.axisLeftLegend,
                legendPosition: "middle" as const,
                legendOffset: -140,
            },
        }

    return (
        <div className="flex-1 min-h-0 w-full relative">
            <LazyResponsiveLine
                data={props.data}
                margin={{ top: pit + legendPad, right: pit, bottom: 28 + axisBottomPad, left: 64 + axisLeftPad }}
                curve="linear"
                lineWidth={props.compact ? 3 : 4}
                pointSize={props.compact ? 0 : 4}
                pointBorderWidth={0}
                enableArea={props.enableArea ?? false}
                areaOpacity={0.12}
                enablePoints={!props.compact}
                enablePointLabel={false}
                colors={chartColors}
                enableGridX={false}
                enableGridY={false}
                theme={nivoTheme}
                legends={showLegend ? [{ ...defaultLegend }] : []}
                useMesh
                crosshairType="cross"
                tooltip={({ point }) => {
                    const yVal = Number(point.data.y)
                    const yFormatted = Number.isFinite(yVal)
                        ? '$' + Math.round(yVal).toLocaleString('es-CL')
                        : String(point.data.yFormatted)
                    return (
                        <div className="bg-popover text-popover-foreground border border-border rounded-md px-3 py-1.5 text-xs shadow-floating whitespace-nowrap">
                            <span className="font-medium">{String(point.data.xFormatted)}</span>
                            <span className="ml-2 font-bold">{yFormatted}</span>
                        </div>
                    )
                }}
                {...axes}
            />
        </div>
    )
}

function PieChartRenderer(props: PieChartConfig) {
    const pit = props.compact ? 4 : 16
    const showLegend = props.showLegend ?? true
    const legendPad = showLegend && !props.compact ? 24 : 0

    return (
        <div className="flex-1 min-h-0 w-full relative">
            <LazyResponsivePie
                data={props.data}
                innerRadius={props.innerRadius ?? 0}
                padAngle={0}
                cornerRadius={0}
                borderWidth={2}
                borderColor={{ theme: "background" }}
                enableArcLinkLabels={props.enableArcLinkLabels ?? false}
                arcLinkLabelsOffset={4}
                arcLinkLabelsThickness={1}
                arcLinkLabelsTextOffset={4}
                arcLinkLabelsTextColor={{ theme: "labels.text.fill" }}
                enableArcLabels={props.enableLabels ?? true}
                arcLabel={props.arcLabel as any ?? "id"}
                arcLabelsRadiusOffset={0.55}
                arcLabelsSkipAngle={8}
                margin={{ top: pit + legendPad, right: pit, bottom: pit, left: pit }}
                colors={{ datum: "data.color" }}
                theme={nivoTheme}
                legends={showLegend ? [{ ...defaultLegend }] : []}
                tooltip={({ datum }) => {
                    const val = Number(datum.value)
                    let formatted: string
                    if (!Number.isFinite(val)) {
                        formatted = String(val)
                    } else if (props.valueFormat === "currency") {
                        formatted = '$' + Math.round(val).toLocaleString('es-CL')
                    } else {
                        formatted = val.toLocaleString('es-CL')
                    }
                    return (
                        <div className="bg-popover text-popover-foreground border border-border rounded-md px-3 py-1.5 text-xs shadow-floating whitespace-nowrap">
                            <span className="font-medium">{String(datum.id)}</span>
                            <span className="ml-2 font-bold">{formatted}</span>
                        </div>
                    )
                }}
            />
        </div>
    )
}

export function AnalyticsChart(props: Props) {
    switch (props.type) {
        case "bar-chart":
            return <BarChartRenderer {...props} />
        case "line-chart":
            return <LineChartRenderer {...props} />
        case "pie-chart":
            return <PieChartRenderer {...props} />
    }
}
