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

export interface CenterLabel {
    value: string | number
    label?: string
}

export interface PieChartProps {
    data: { id?: string | number; name?: string | number; value: number; [key: string]: unknown }[]
    renderTooltip?: (datum: {
        id: string | number
        label?: string | number
        value: number
        color: string
    }) => React.ReactNode
    centerLabel?: CenterLabel
    colors?: unknown
    innerRadius?: number
    padAngle?: number
    cornerRadius?: number
    activeOuterRadiusOffset?: number
    activeInnerRadiusOffset?: number
    borderWidth?: number
    enableArcLinkLabels?: boolean
    enableArcLabels?: boolean
    arcLabelsRadiusOffset?: number
    arcLabelsSkipAngle?: number
    arcLabelsTextColor?: unknown
    arcLabel?: unknown
    legends?: unknown[]
    margin?: { top: number; right: number; bottom: number; left: number }
}

function getArcTextColor(d: { color: string }): string {
    const m = d.color.match(/oklch\(\s*([\d.]+)/)
    if (m) return parseFloat(m[1]) > 0.75 ? "hsl(var(--foreground))" : "#ffffff"
    if (d.color.startsWith("#")) {
        const r = parseInt(d.color.slice(1, 3), 16)
        const g = parseInt(d.color.slice(3, 5), 16)
        const b = parseInt(d.color.slice(5, 7), 16)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminance > 0.6 ? "hsl(var(--foreground))" : "#ffffff"
    }
    return "#ffffff"
}

export function PieChart({
    data: rawData,
    renderTooltip,
    centerLabel,
    colors,
    enableArcLabels,
    legends,
    margin,
    arcLabelsTextColor: arcLabelsTextColorProp,
    ...rest
}: PieChartProps) {
    const chartColors = useMemo(() => getCssChartColors("pie"), [])
    const chartData = useMemo(
        () =>
            rawData.map((d, i) => ({
                ...d,
                id: d.id ?? d.name,
                color: d.color ?? chartColors[i % chartColors.length],
            })) as unknown as readonly MayHaveLabel[],
        [rawData, chartColors],
    )

    const arcLabelsTextColor = arcLabelsTextColorProp ?? getArcTextColor

    if (chartData.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Sin datos
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative h-full w-full">
            <LazyPie
                {...pieDefaults}
                data={chartData}
                colors={(colors ?? { datum: "data.color" }) as unknown as string | string[] | { datum: string }}
                enableArcLabels={enableArcLabels ?? pieDefaults.enableArcLabels}
                arcLabelsTextColor={arcLabelsTextColor as unknown as string}
                theme={nivoTheme}
                legends={legends as unknown as readonly LegendProps[] | undefined}
                margin={margin}
                motionConfig="gentle"
                tooltip={({ datum }: { datum: { id: string | number; label?: string | number; value: number; color: string } }) => (
                    <div className={premiumTooltipClass}>
                        {renderTooltip ? (
                            renderTooltip(datum)
                        ) : (
                            <>
                                <span className="font-medium">{String(datum.label ?? datum.id)}</span>
                                <span className="ml-2 font-bold">
                                    {/* eslint-disable-next-line no-restricted-syntax -- Nivo chart tooltip; MoneyDisplay not applicable in SVG context */}
                                    {Number(datum.value).toLocaleString()}
                                </span>
                            </>
                        )}
                    </div>
                )}
                {...rest as Record<string, unknown>}
            />
            {centerLabel && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ transform: "translateY(-6%)" }}>
                    <div className="text-center">
                        <div className="text-xl font-black  tracking-tighter text-foreground">
                            {centerLabel.value}
                        </div>
                        {centerLabel.label && (
                            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                {centerLabel.label}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
