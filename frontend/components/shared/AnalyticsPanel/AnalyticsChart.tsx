"use client"

import React from "react"
import type { BarChartConfig, LineChartConfig, PieChartConfig } from "./types"
import { PieChart, BarChart, LineChart } from "../charts"
import { formatCompactSpanish } from "@/lib/utils/number"
import {
    nivoTheme,
    barDefaults,
    pieDefaults,
    cardBarDefaults,
    cardLineDefaults,
    cardPieDefaults,
    cardLegend,
} from "./nivo-theme"

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
    const isCard = props.preset === "card"
    const isCompact = props.compact

    const showLegend = isCard
        ? (props.lineOverlay ? true : props.keys.length > 1)
        : isCompact
            ? false
            : (props.showLegend ?? true)

    const cardMargin = {
        ...cardBarDefaults.margin,
        bottom: showLegend ? 56 : cardBarDefaults.margin.bottom,
    }

    const margin = isCard
        ? cardMargin
        : isCompact
            ? { top: 4, right: 4, bottom: 28, left: 64 }
            : { top: 40, right: 16, bottom: 28 + (props.axisBottomLegend ? 20 : 0), left: 64 + (props.axisLeftLegend ? 96 : 0) }

    const isCurrency = props.valueFormat === "$,.0f"
    const compactFmt = (v: number) => formatCompactSpanish(v, isCurrency)

    const axes = isCompact
        ? { axisBottom: null, axisLeft: null }
        : isCard
            ? {
                axisBottom: {
                    tickSize: 0,
                    tickPadding: 8,
                    legend: props.axisBottomLegend,
                    legendPosition: "middle" as const,
                    legendOffset: 28,
                    format: compactFmt,
                },
                axisLeft: {
                    tickSize: 0,
                    tickPadding: 8,
                    legend: props.axisLeftLegend,
                    legendPosition: "middle" as const,
                    legendOffset: -40,
                    format: compactFmt,
                },
            }
            : {
                axisBottom: props.axisBottomLegend
                    ? {
                        tickSize: 0,
                        tickPadding: 8,
                        legend: props.axisBottomLegend,
                        legendPosition: "middle" as const,
                        legendOffset: 36,
                    }
                    : { tickSize: 0, tickPadding: 8 },
                axisLeft: {
                    tickSize: 0,
                    tickPadding: 8,
                    format: props.valueFormat ?? "$,.0f",
                    legend: props.axisLeftLegend,
                    legendPosition: "middle" as const,
                    legendOffset: -140,
                },
            }

    const legendItems = props.lineOverlay && showLegend
        ? [
            ...(props.keys ?? []).map((key) => ({
                id: key,
                label: key.charAt(0).toUpperCase() + key.slice(1),
                color: undefined,
            })),
            {
                id: "line",
                label: props.lineOverlay.label,
                color: props.lineOverlay.color ?? "#f59e0b",
            },
        ]
        : undefined

    const legendConfig = isCard ? cardLegend : defaultLegend

    const barLegends = legendItems
        ? [{ data: legendItems, dataFrom: "keys" as const, ...legendConfig }]
        : showLegend
            ? [{ dataFrom: "keys" as const, ...legendConfig }]
            : []

    return (
        <div className="flex-1 min-h-[300px] w-full relative">
            <BarChart
                data={props.data}
                keys={props.keys}
                indexBy={props.indexBy}
                padding={props.padding ?? (isCard ? cardBarDefaults.padding : barDefaults.padding)}
                borderRadius={props.borderRadius ?? (isCard ? cardBarDefaults.borderRadius : barDefaults.borderRadius)}
                valueFormat={props.valueFormat}
                margin={margin}
                enableGridY={props.enableGridY ?? (isCard ? cardBarDefaults.enableGridY : barDefaults.enableGridY)}
                legends={barLegends}
                {...axes}
            />
        </div>
    )
}

function LineChartRenderer(props: LineChartConfig) {
    const isCard = props.preset === "card"
    const isCompact = props.compact

    const showLegend = isCard
        ? props.data.length > 1
        : isCompact
            ? false
            : (props.showLegend ?? true)

    const cardMargin = {
        ...cardLineDefaults.margin,
        bottom: showLegend ? 56 : cardLineDefaults.margin.bottom,
    }

    const margin = isCard
        ? cardMargin
        : isCompact
            ? { top: 4, right: 4, bottom: 28, left: 64 }
            : { top: 40, right: 16, bottom: 28 + (props.axisBottomLegend ? 20 : 0), left: 64 + (props.axisLeftLegend ? 96 : 0) }

    const isCurrency = props.valueFormat === "$,.0f"
    const compactFmt = (v: number) => formatCompactSpanish(v, isCurrency)

    const axes = isCompact
        ? { axisBottom: null, axisLeft: null }
        : isCard
            ? {
                axisBottom: {
                    tickSize: 0,
                    tickPadding: 8,
                    legend: props.axisBottomLegend,
                    legendPosition: "middle" as const,
                    legendOffset: 28,
                    format: compactFmt,
                },
                axisLeft: {
                    tickSize: 0,
                    tickPadding: 8,
                    legend: props.axisLeftLegend,
                    legendPosition: "middle" as const,
                    legendOffset: -40,
                    format: compactFmt,
                },
            }
            : {
                axisBottom: props.axisBottomLegend
                    ? {
                        tickSize: 0,
                        tickPadding: 8,
                        legend: props.axisBottomLegend,
                        legendPosition: "middle" as const,
                        legendOffset: 36,
                    }
                    : { tickSize: 0, tickPadding: 8 },
                axisLeft: {
                    tickSize: 0,
                    tickPadding: 8,
                    format: props.valueFormat ?? "$,.0f",
                    legend: props.axisLeftLegend,
                    legendPosition: "middle" as const,
                    legendOffset: -140,
                },
            }

    const legendConfig = isCard ? cardLegend : defaultLegend

    return (
        <div className="flex-1 min-h-[300px] w-full relative">
            <LineChart
                data={props.data}
                margin={margin}
                lineWidth={isCard ? cardLineDefaults.lineWidth : undefined}
                pointSize={isCard ? cardLineDefaults.pointSize : undefined}
                enableArea={isCard ? cardLineDefaults.enableArea : props.enableArea}
                areaOpacity={isCard ? cardLineDefaults.areaOpacity : undefined}
                enablePointLabel={isCard ? cardLineDefaults.enablePointLabel : undefined}
                useMesh={isCard ? cardLineDefaults.useMesh : undefined}
                crosshairType={isCard ? cardLineDefaults.crosshairType : undefined}
                legends={showLegend ? [{ ...legendConfig }] : []}
                {...axes}
            />
        </div>
    )
}

function PieChartRenderer(props: PieChartConfig) {
    const isCard = props.preset === "card"
    const isCompact = props.compact

    const margin = isCard
        ? cardPieDefaults.margin
        : isCompact
            ? { top: 4, right: 4, bottom: 4, left: 4 }
            : { top: 40, right: 16, bottom: 16, left: 16 }

    const showLegend = isCard
        ? props.data.length > 2
        : isCompact
            ? false
            : (props.showLegend ?? true)

    const legendConfig = isCard ? cardLegend : defaultLegend

    return (
        <div className="flex-1 min-h-[300px] w-full relative">
            <PieChart
                data={props.data}
                innerRadius={isCard ? cardPieDefaults.innerRadius : props.innerRadius}
                enableArcLinkLabels={isCard ? cardPieDefaults.enableArcLinkLabels : props.enableArcLinkLabels}
                enableArcLabels={isCard ? cardPieDefaults.enableArcLabels : props.enableLabels}
                arcLabel={isCard
                    ? ({ percentage }: { percentage: number }) => `${Math.round(percentage)}%`
                    : props.arcLabel
                }
                arcLabelsFont={isCard ? cardPieDefaults.arcLabelsFont : undefined}
                arcLabelsRadiusOffset={isCard ? cardPieDefaults.arcLabelsRadiusOffset : undefined}
                arcLabelsSkipAngle={isCard ? cardPieDefaults.arcLabelsSkipAngle : undefined}
                centerLabel={props.centerLabel}
                padAngle={isCard ? cardPieDefaults.padAngle : undefined}
                cornerRadius={isCard ? cardPieDefaults.cornerRadius : undefined}
                borderWidth={isCard ? cardPieDefaults.borderWidth : undefined}
                borderColor={isCard ? cardPieDefaults.borderColor : undefined}
                legends={showLegend ? [{ ...legendConfig }] : []}
                margin={margin}
                renderTooltip={
                    props.valueFormat
                        ? ({ id, value }) => {
                              const val = Number(value)
                              let formatted: string
                              if (!Number.isFinite(val)) {
                                  formatted = String(val)
                              } else if (props.valueFormat === "currency") {
                                  formatted =
                                      "$" + Math.round(val).toLocaleString("es-CL")
                              } else {
                                  formatted = val.toLocaleString("es-CL")
                              }
                              return (
                                  <>
                                      <span className="font-medium">{String(id)}</span>
                                      <span className="ml-2 font-bold">{formatted}</span>
                                  </>
                              )
                          }
                        : undefined
                }
            />
        </div>
    )
}

export function AnalyticsChart(props: BarChartConfig | LineChartConfig | PieChartConfig) {
    switch (props.type) {
        case "bar-chart":
            return <BarChartRenderer {...props} />
        case "line-chart":
            return <LineChartRenderer {...props} />
        case "pie-chart":
            return <PieChartRenderer {...props} />
    }
}
