"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatQuantity } from "@/lib/money"
import type { FunnelDatum, FunnelPart } from "@nivo/funnel"
import type { InheritedColorConfig } from "@nivo/colors"
import {
    nivoTheme,
    premiumTooltipClass,
    getCssChartColors,
} from "../AnalyticsPanel/nivo-theme"

const LazyFunnel = dynamic(() => import("@nivo/funnel").then((m) => ({ default: m.ResponsiveFunnel })), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
})

export interface FunnelChartProps {
    data: { id: string | number; value: number; label?: string; color?: string }[]
    valueFormat?: string
    tooltipFormat?: "currency" | "number" | ((value: number) => string)
    margin?: { top: number; right: number; bottom: number; left: number }
    direction?: "horizontal" | "vertical"
    shapeBlending?: number
    enableLabel?: boolean
    motionConfig?: string
}

function formatTooltipValue(value: number, format?: "currency" | "number" | ((value: number) => string)): string {
    if (format === "currency") return formatMoney(value)
    if (format === "number") return formatQuantity(value)
    if (typeof format === "function") return format(value)
    return formatQuantity(value)
}

export function FunnelChart({
    data,
    valueFormat,
    tooltipFormat,
    margin = { top: 20, right: 20, bottom: 20, left: 20 },
    direction = "horizontal",
    shapeBlending = 0.66,
    enableLabel = true,
    motionConfig = "gentle",
}: FunnelChartProps) {
    // Map each datum id → resolved color (hex), so nivo can use a function scale
    const colorById = useMemo(() => {
        const palette = getCssChartColors()
        const map: Record<string | number, string> = {}
        data.forEach((d, i) => {
            map[d.id] = d.color ?? palette[i % palette.length]
        })
        return map
    }, [data])

    return (
        <div className="h-full w-full relative">
            <LazyFunnel
                data={data as unknown as FunnelDatum[]}
                margin={margin}
                valueFormat={valueFormat}
                colors={(d: FunnelDatum) => colorById[d.id] ?? "var(--color-muted-foreground)"}
                direction={direction}
                shapeBlending={shapeBlending}
                borderWidth={0}
                enableLabel={enableLabel}
                enableBeforeSeparators={false}
                enableAfterSeparators={false}
                currentPartSizeExtension={0}
                currentBorderWidth={0}
                motionConfig={motionConfig}
                theme={nivoTheme}
                labelColor={{ from: "color", modifiers: [["darker", 3]] } as unknown as InheritedColorConfig<FunnelPart<FunnelDatum>>}
                tooltip={({ part }: { part: { data: { id: string | number; value: number; label?: string }; color: string } }) => (
                    <div className={premiumTooltipClass}>
                        <span className="font-medium">{String(part.data.label ?? part.data.id)}</span>
                        <span className="ml-2 font-bold">{formatTooltipValue(part.data.value, tooltipFormat)}</span>
                    </div>
                )}
            />
        </div>
    )
}
