"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
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
    const data = useMemo(
        () =>
            rawData.map((d, i) => ({
                ...d,
                id: d.id ?? d.name,
                color: chartColors[i % chartColors.length],
            })),
        [rawData, chartColors],
    )

    return (
        <LazyPie
            {...pieDefaults}
            data={data}
            colors={colors ?? ({ datum: "data.color" } as any)}
            enableArcLabels={enableArcLabels ?? pieDefaults.enableArcLabels}
            theme={nivoTheme}
            legends={legends as any}
            margin={margin}
            tooltip={({ datum }: any) => (
                <div className={premiumTooltipClass}>
                    {renderTooltip ? (
                        renderTooltip(datum)
                    ) : (
                        <>
                            <span className="font-medium">{String(datum.id)}</span>
                            <span className="ml-2 font-bold">
                                {Number(datum.value).toLocaleString()}
                            </span>
                        </>
                    )}
                </div>
            )}
            {...(rest as any)}
        />
    )
}
