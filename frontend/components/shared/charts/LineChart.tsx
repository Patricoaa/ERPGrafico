"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import {
    nivoTheme,
    lineDefaults,
    premiumTooltipClass,
    getCssChartColors,
} from "../AnalyticsPanel/nivo-theme"

const LazyLine = dynamic(
    () => import("@nivo/line").then((m) => ({ default: m.ResponsiveLine })),
    {
        ssr: false,
        loading: () => <Skeleton className="h-full w-full rounded-md" />,
    },
)

export interface LineChartProps {
    data: { id: string | number; data: { x: number | string | Date | null; y: number | string | Date | null }[] }[]
    renderTooltip?: (point: {
        serieId: string | number
        data: { x: unknown; y: unknown; xFormatted?: unknown; yFormatted?: unknown }
    }) => React.ReactNode
    colors?: unknown
    enableArea?: boolean
    pointSize?: number
    margin?: { top: number; right: number; bottom: number; left: number }
    legends?: unknown[]
    [key: string]: unknown
}

export function LineChart({ data, renderTooltip, colors, ...rest }: LineChartProps) {
    const chartColors = useMemo(() => getCssChartColors(), [])

    return (
        <LazyLine
            {...lineDefaults}
            data={data}
            colors={(colors ?? chartColors) as string | string[]}
            theme={nivoTheme}
            tooltip={({ point }: { point: { seriesId: string | number; data: { x: unknown; y: unknown; xFormatted?: unknown; yFormatted?: unknown } } }) => (
                <div className={premiumTooltipClass}>
                    {renderTooltip ? (
                        renderTooltip({ serieId: point.seriesId, data: point.data })
                    ) : (
                        <>
                            <span className="font-medium">
                                {String(point.data.xFormatted ?? point.data.x)}
                            </span>
                            <span className="ml-2 font-bold">
                                {String(point.data.yFormatted ?? point.data.y)}
                            </span>
                        </>
                    )}
                </div>
            )}
            {...rest as Record<string, unknown>}
        />
    )
}
