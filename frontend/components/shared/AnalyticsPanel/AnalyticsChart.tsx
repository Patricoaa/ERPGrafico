"use client"

import React from "react"
import type { BarChartConfig, LineChartConfig, PieChartConfig } from "./types"
import { PieChart, BarChart, LineChart } from "../charts"

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
    const pit = props.compact ? 4 : 16
    const showLegend = props.showLegend ?? true
    const legendPad = showLegend && !props.compact ? 24 : 0
    const axisBottomPad = props.axisBottomLegend ? 20 : 0
    const axisLeftPad = props.axisLeftLegend ? 96 : 0
    const axes = props.compact
        ? { axisBottom: null, axisLeft: null }
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
            ...(props.keys ?? []).map((key, i) => ({
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

    const barLegends = legendItems
        ? [{ data: legendItems, dataFrom: "keys" as const, ...defaultLegend }]
        : showLegend
            ? [{ dataFrom: "keys" as const, ...defaultLegend }]
            : []

    return (
        <div className="flex-1 min-h-0 w-full relative">
            <BarChart
                data={props.data}
                keys={props.keys}
                indexBy={props.indexBy}
                padding={props.padding}
                borderRadius={props.borderRadius}
                valueFormat={props.valueFormat}
                margin={{ top: pit + legendPad, right: pit, bottom: 28 + axisBottomPad, left: 64 + axisLeftPad }}
                enableGridY={props.enableGridY}
                legends={barLegends}
                {...axes}
            />
        </div>
    )
}

function LineChartRenderer(props: LineChartConfig) {
    const pit = props.compact ? 4 : 16
    const showLegend = props.showLegend ?? true
    const legendPad = showLegend && !props.compact ? 24 : 0
    const axisBottomPad = props.axisBottomLegend ? 20 : 0
    const axisLeftPad = props.axisLeftLegend ? 96 : 0
    const axes = props.compact
        ? { axisBottom: null, axisLeft: null }
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

    return (
        <div className="flex-1 min-h-0 w-full relative">
            <LineChart
                data={props.data}
                margin={{ top: pit + legendPad, right: pit, bottom: 28 + axisBottomPad, left: 64 + axisLeftPad }}
                enableArea={props.enableArea}
                legends={showLegend ? [{ ...defaultLegend }] : []}
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
            <PieChart
                data={props.data}
                innerRadius={props.innerRadius}
                enableArcLinkLabels={props.enableArcLinkLabels}
                enableArcLabels={props.enableLabels}
                arcLabel={props.arcLabel}
                legends={showLegend ? [{ ...defaultLegend }] : []}
                margin={{ top: pit + legendPad, right: pit, bottom: pit, left: pit }}
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
