"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { BarDatum, BarLegendProps, ComputedDatum } from "@nivo/bar"
import {
    nivoTheme,
    barDefaults,
    premiumTooltipClass,
    getCssChartColors,
} from "../AnalyticsPanel/nivo-theme"

const LazyBar = dynamic(() => import("@nivo/bar").then((m) => ({ default: m.ResponsiveBar })), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
})

export interface BarChartProps {
    data: Record<string, unknown>[]
    keys: string[]
    indexBy: string
    renderTooltip?: (datum: {
        id: string | number
        value: number
        indexValue: string | number
        color: string
    }) => React.ReactNode
    colors?: unknown
    padding?: number
    borderRadius?: number
    enableGridX?: boolean
    enableGridY?: boolean
    groupMode?: "grouped" | "stacked"
    layout?: "horizontal" | "vertical"
    valueFormat?: string
    legends?: unknown[]
    margin?: { top: number; right: number; bottom: number; left: number }
    [key: string]: unknown
}

export function BarChart({
    data,
    keys,
    indexBy,
    renderTooltip,
    colors,
    padding,
    borderRadius,
    enableGridX,
    enableGridY,
    groupMode,
    layout,
    legends,
    margin,
    ...rest
}: BarChartProps) {
    const chartColors = useMemo(() => getCssChartColors(), [])

    return (
        <LazyBar
            {...barDefaults}
            data={data as unknown as readonly BarDatum[]}
            keys={keys}
            indexBy={indexBy}
            colors={(colors ?? chartColors) as string | string[]}
            padding={padding ?? barDefaults.padding}
            borderRadius={borderRadius ?? barDefaults.borderRadius}
            enableGridX={enableGridX ?? barDefaults.enableGridX}
            enableGridY={enableGridY ?? barDefaults.enableGridY}
            groupMode={groupMode}
            layout={layout}
            legends={legends as unknown as readonly BarLegendProps[] | undefined}
            margin={margin}
            theme={nivoTheme}
            tooltip={({ id, value, indexValue, color }: { id: string | number; value: number; indexValue: string | number; color: string }) => (
                <div className={premiumTooltipClass}>
                    {renderTooltip ? (
                        renderTooltip({ id, value, indexValue, color })
                    ) : (
                        <>
                            <span className="font-medium">{String(indexValue)}</span>
                            <span className="ml-2 font-bold">
                                {Number(value).toLocaleString()}
                            </span>
                        </>
                    )}
                </div>
            )}
            {...rest as Record<string, unknown>}
        />
    )
}
