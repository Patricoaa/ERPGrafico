"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { MayHaveLabel } from "@nivo/pie"
import type { LegendProps } from "@nivo/legends"
import {
    nivoTheme,
    pieDefaults,
    premiumTooltipClass,
    getCssChartColors,
} from "../AnalyticsPanel/nivo-theme"

const LazyPie = dynamic(() => import("@nivo/pie").then((m) => ({ default: m.ResponsivePie })), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
})

export interface PieChartProps {
    data: { id?: string | number; name?: string | number; value: number; [key: string]: unknown }[]
    renderTooltip?: (datum: {
        id: string | number
        label?: string | number
        value: number
        color: string
    }) => React.ReactNode
    colors?: unknown
    innerRadius?: number
    padAngle?: number
    cornerRadius?: number
    activeOuterRadiusOffset?: number
    borderWidth?: number
    enableArcLinkLabels?: boolean
    enableArcLabels?: boolean
    arcLabelsRadiusOffset?: number
    arcLabelsSkipAngle?: number
    arcLabelsTextColor?: string
    arcLabel?: unknown
    legends?: unknown[]
    margin?: { top: number; right: number; bottom: number; left: number }
}

export function PieChart({
    data: rawData,
    renderTooltip,
    colors,
    enableArcLabels,
    legends,
    margin,
    ...rest
}: PieChartProps) {
    const chartColors = useMemo(() => getCssChartColors(), [])
    const chartData = useMemo(
        () =>
            rawData.map((d, i) => ({
                ...d,
                id: d.id ?? d.name,
                color: d.color ?? chartColors[i % chartColors.length],
            })) as unknown as readonly MayHaveLabel[],
        [rawData, chartColors],
    )

    return (
        <LazyPie
            {...pieDefaults}
            data={chartData}
            colors={(colors ?? { datum: "data.color" }) as unknown as string | string[] | { datum: string }}
            enableArcLabels={enableArcLabels ?? pieDefaults.enableArcLabels}
            theme={nivoTheme}
            legends={legends as unknown as readonly LegendProps[] | undefined}
            margin={margin}
            tooltip={({ datum }: { datum: { id: string | number; label?: string | number; value: number; color: string } }) => (
                <div className={premiumTooltipClass}>
                    {renderTooltip ? (
                        renderTooltip(datum)
                    ) : (
                        <>
                            <span className="font-medium">{String(datum.label ?? datum.id)}</span>
                            <span className="ml-2 font-bold">
                                {Number(datum.value).toLocaleString()}
                            </span>
                        </>
                    )}
                </div>
            )}
            {...rest as Record<string, unknown>}
        />
    )
}
