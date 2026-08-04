"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import {
    nivoTheme,
    premiumTooltipClass,
    getCssChartColors,
} from "../AnalyticsPanel/nivo-theme"

const LazyRadar = dynamic(
    () => import("@nivo/radar").then((m) => ({ default: m.ResponsiveRadar })),
    {
        ssr: false,
        loading: () => <Skeleton className="h-full w-full rounded-md" />,
    },
)

export interface RadarChartProps {
    data: Record<string, unknown>[]
    keys: string[]
    indexBy: string
    colors?: unknown
    margin?: { top: number; right: number; bottom: number; left: number }
    legends?: unknown[]
    maxValue?: number | "auto"
    [key: string]: unknown
}

export function RadarChart({
    data,
    keys,
    indexBy,
    colors,
    margin,
    legends,
    maxValue,
    ...rest
}: RadarChartProps) {
    const chartColors = useMemo(() => getCssChartColors(), [])

    return (
        <LazyRadar
            data={data}
            keys={keys}
            indexBy={indexBy}
            colors={(colors ?? chartColors) as string | string[]}
            maxValue={maxValue ?? "auto"}
            margin={margin ?? { top: 40, right: 80, bottom: 40, left: 80 }}
            gridLabelOffset={18}
            dotSize={8}
            dotColor={{ theme: "background" }}
            dotBorderWidth={2}
            dotBorderColor={{ from: "color" }}
            blendMode="normal"
            fillOpacity={0.15}
            borderWidth={2}
            theme={nivoTheme}
            // @ts-expect-error - nivo radar legends type is complex
            legends={legends}
            tooltip={({ index, data: tooltipData }: { index: string; data: Record<string, number | string> }) => (
                <div className={premiumTooltipClass}>
                    <span className="font-medium">{String(index)}</span>
                    {keys.map((k) => (
                        <span key={k} className="ml-2 font-bold">
                            {k}: {String(tooltipData[k] ?? "")}
                        </span>
                    ))}
                </div>
            )}
            {...(rest as Record<string, unknown>)}
        />
    )
}
