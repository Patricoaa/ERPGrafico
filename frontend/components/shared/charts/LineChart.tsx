"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatQuantity } from "@/lib/money"
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

function formatTooltipValue(value: number, format?: "currency" | "number" | ((value: number) => string)): string {
    if (format === "currency") return formatMoney(value)
    if (format === "number") return formatQuantity(value)
    if (typeof format === "function") return format(value)
    return String(value)
}

export interface LineChartProps {
    data: { id: string | number; data: { x: number | string | Date | null; y: number | string | Date | null }[] }[]
    renderTooltip?: (point: {
        serieId: string | number
        data: { x: unknown; y: unknown; xFormatted?: unknown; yFormatted?: unknown }
    }) => React.ReactNode
    tooltipFormat?: "currency" | "number" | ((value: number) => string)
    colors?: unknown
    enableArea?: boolean
    pointSize?: number
    margin?: { top: number; right: number; bottom: number; left: number }
    legends?: unknown[]
    [key: string]: unknown
}

export function LineChart({ data, renderTooltip, tooltipFormat, colors, ...rest }: LineChartProps) {
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
                                {formatTooltipValue(point.data.y as number, tooltipFormat)}
                            </span>
                        </>
                    )}
                </div>
            )}
            {...rest as Record<string, unknown>}
        />
    )
}
