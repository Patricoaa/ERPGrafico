"use client"

import React, { useId, useMemo, useRef, useState, useEffect } from "react"
import { formatMoney, formatQuantity } from "@/lib/money"
import { getChartPalette } from "@/lib/chart-colors"
import { cn } from "@/lib/utils"

export interface DualAxisDataPoint {
    x: string
    y: number
}

export interface DualAxisSeries {
    id: string
    label: string
    axis: "left" | "right"
    type: "line" | "bar"
    color?: string
    data: DualAxisDataPoint[]
}

export interface DualAxisChartProps {
    series: DualAxisSeries[]
    periods: string[]
    leftAxisFormat?: "currency" | "number" | ((value: number) => string)
    rightAxisFormat?: "currency" | "number" | ((value: number) => string)
    leftAxisLabel?: string
    rightAxisLabel?: string
    mode?: "bar-line" | "line-line"
    ariaLabel?: string
    className?: string
    height?: number | string
    margin?: { top: number; right: number; bottom: number; left: number }
}

function formatValue(value: number, format?: "currency" | "number" | ((v: number) => string)): string {
    if (format === "currency") return formatMoney(value)
    if (format === "number") return formatQuantity(value)
    if (typeof format === "function") return format(value)
    return formatQuantity(value)
}

const DEFAULT_MARGIN = { top: 28, right: 68, bottom: 32, left: 68 }

/**
 * Gráfico compuesto de doble eje Y reutilizable.
 * Soporta series en eje izquierdo (Y1) y eje derecho (Y2), en modo Línea + Columnas o Línea + Línea,
 * con filtros interactivos de series por leyenda y tooltip unificado.
 */
export function DualAxisChart({
    series,
    periods,
    leftAxisFormat = "currency",
    rightAxisFormat = "currency",
    leftAxisLabel,
    rightAxisLabel,
    mode = "bar-line",
    ariaLabel,
    className,
    height = 360,
    margin = DEFAULT_MARGIN,
}: DualAxisChartProps) {
    const chartId = useId()
    const containerRef = useRef<HTMLDivElement>(null)
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 360 })
    const [activeSeriesIds, setActiveSeriesIds] = useState<Set<string>>(() => new Set(series.map((s) => s.id)))
    const [hoverIndex, setHoverIndex] = useState<number | null>(null)

    // Sincronizar series activas si cambia la lista de series
    useEffect(() => {
        setActiveSeriesIds((current) => {
            const next = new Set<string>()
            for (const s of series) {
                if (current.has(s.id)) next.add(s.id)
            }
            return next.size > 0 ? next : new Set(series.map((s) => s.id))
        })
    }, [series])

    // Responsividad vía ResizeObserver
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height: h } = entry.contentRect
                if (width > 0 && h > 0) {
                    setDimensions({ width, height: h })
                }
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const palette = useMemo(() => getChartPalette(), [])

    const coloredSeries = useMemo(() => {
        return series.map((s, idx) => ({
            ...s,
            color: s.color ?? palette[idx % palette.length],
        }))
    }, [series, palette])

    // Series activas separadas por eje
    const activeLeftSeries = useMemo(() => {
        return coloredSeries.filter((s) => s.axis === "left" && activeSeriesIds.has(s.id))
    }, [coloredSeries, activeSeriesIds])

    const activeRightSeries = useMemo(() => {
        return coloredSeries.filter((s) => s.axis === "right" && activeSeriesIds.has(s.id))
    }, [coloredSeries, activeSeriesIds])

    // Map de valores por serie y período
    const seriesValuesMap = useMemo(() => {
        const map = new Map<string, Map<string, number>>()
        for (const s of coloredSeries) {
            const pMap = new Map<string, number>()
            for (const dp of s.data) {
                pMap.set(dp.x, dp.y)
            }
            map.set(s.id, pMap)
        }
        return map
    }, [coloredSeries])

    // Escalas de valores Y1 (Izquierda)
    const { minY1, maxY1 } = useMemo(() => {
        const values: number[] = []
        for (const s of activeLeftSeries) {
            for (const dp of s.data) {
                if (Number.isFinite(dp.y)) values.push(dp.y)
            }
        }
        if (values.length === 0) return { minY1: 0, maxY1: 100 }
        const min = Math.min(...values)
        const max = Math.max(...values)
        // Redondeo amigable
        const padding = (max - min) * 0.1 || max * 0.1 || 10
        return {
            minY1: Math.max(0, Math.floor((min - padding) / 10) * 10),
            maxY1: Math.ceil((max + padding) / 10) * 10,
        }
    }, [activeLeftSeries])

    // Escalas de valores Y2 (Derecha)
    const { minY2, maxY2 } = useMemo(() => {
        const values: number[] = []
        for (const s of activeRightSeries) {
            for (const dp of s.data) {
                if (Number.isFinite(dp.y)) values.push(dp.y)
            }
        }
        if (values.length === 0) return { minY2: 0, maxY2: 100 }
        const max = Math.max(...values)
        const padding = max * 0.15 || 10
        return {
            minY2: 0,
            maxY2: Math.ceil((max + padding) / 10) * 10,
        }
    }, [activeRightSeries])

    const innerWidth = Math.max(0, dimensions.width - margin.left - margin.right)
    const innerHeight = Math.max(0, dimensions.height - margin.top - margin.bottom)

    const scaleX = (index: number) => {
        if (periods.length <= 1) return margin.left + innerWidth / 2
        return margin.left + (index + 0.5) * (innerWidth / periods.length)
    }

    const scaleY1 = (val: number) => {
        if (maxY1 <= minY1) return margin.top + innerHeight / 2
        const pct = (val - minY1) / (maxY1 - minY1)
        return margin.top + innerHeight - pct * innerHeight
    }

    const scaleY2 = (val: number) => {
        if (maxY2 <= minY2) return margin.top + innerHeight / 2
        const pct = (val - minY2) / (maxY2 - minY2)
        return margin.top + innerHeight - pct * innerHeight
    }

    // Ticks para líneas de cuadrícula horizontales
    const gridTicks = useMemo(() => {
        const count = 4
        const ticks: Array<{ y: number; valLeft: number; valRight: number }> = []
        for (let i = 0; i <= count; i++) {
            const y = margin.top + (innerHeight / count) * i
            const valLeft = maxY1 - ((maxY1 - minY1) / count) * i
            const valRight = maxY2 - ((maxY2 - minY2) / count) * i
            ticks.push({ y, valLeft, valRight })
        }
        return ticks
    }, [margin.top, innerHeight, minY1, maxY1, minY2, maxY2])

    const toggleSeries = (id: string) => {
        setActiveSeriesIds((current) => {
            const next = new Set(current)
            if (next.has(id)) {
                // Prevenir apagar todas
                if (next.size > 1) next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    // Hover mouse handler
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = containerRef.current
        if (!el || periods.length === 0) return
        const rect = el.getBoundingClientRect()
        const mouseX = e.clientX - rect.left

        if (mouseX < margin.left || mouseX > dimensions.width - margin.right) {
            setHoverIndex(null)
            return
        }

        let closest = 0
        let minDiff = Infinity
        for (let i = 0; i < periods.length; i++) {
            const px = scaleX(i)
            const diff = Math.abs(px - mouseX)
            if (diff < minDiff) {
                minDiff = diff
                closest = i
            }
        }
        setHoverIndex(closest)
    }

    const handleMouseLeave = () => {
        setHoverIndex(null)
    }

    return (
        <div className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs", className)}>
            {/* Header / Leyenda interactiva */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mr-0.5">
                        Series:
                    </span>
                    {coloredSeries.map((s) => {
                        const isActive = activeSeriesIds.has(s.id)
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => toggleSeries(s.id)}
                                aria-pressed={isActive}
                                className={cn(
                                    "flex items-center gap-1 rounded-full border px-1.5 py-px text-3xs font-normal transition-all cursor-pointer leading-none",
                                    isActive
                                        ? "border-foreground/20 bg-muted/50 text-foreground/80"
                                        : "border-transparent bg-muted/20 text-muted-foreground opacity-40 line-through",
                                )}
                            >
                                <span
                                    className={cn("size-1.5 shrink-0", s.type === "bar" && mode === "bar-line" ? "rounded-xs" : "rounded-full")}
                                    style={{ backgroundColor: s.color }}
                                />
                                <span>{s.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Contenedor del Gráfico SVG */}
            <div
                ref={containerRef}
                style={{ height }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative w-full select-none"
                role="img"
                aria-label={ariaLabel ?? `Gráfico compuesto de doble eje, ${series.length} series`}
            >
                <svg className="h-full w-full overflow-visible" aria-hidden="true">
                    <defs>
                        <clipPath id={`chart-clip-${chartId}`}>
                            <rect x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} />
                        </clipPath>
                    </defs>

                    {/* Línea vertical Eje izquierdo (Y1) + título */}
                    <line
                        x1={margin.left}
                        x2={margin.left}
                        y1={margin.top}
                        y2={margin.top + innerHeight}
                        stroke="hsl(var(--border))"
                        strokeWidth={1.5}
                        strokeOpacity={0.8}
                    />
                    {leftAxisLabel && (
                        <text
                            x={margin.left}
                            y={margin.top - 8}
                            textAnchor="start"
                            fontSize={9}
                            className="fill-muted-foreground font-medium"
                        >
                            {leftAxisLabel}
                        </text>
                    )}

                    {/* Línea vertical Eje derecho (Y2) + título */}
                    <line
                        x1={margin.left + innerWidth}
                        x2={margin.left + innerWidth}
                        y1={margin.top}
                        y2={margin.top + innerHeight}
                        stroke="hsl(var(--border))"
                        strokeWidth={1.5}
                        strokeOpacity={0.8}
                    />
                    {rightAxisLabel && (
                        <text
                            x={margin.left + innerWidth}
                            y={margin.top - 8}
                            textAnchor="end"
                            fontSize={9}
                            className="fill-muted-foreground font-medium"
                        >
                            {rightAxisLabel}
                        </text>
                    )}

                    {/* Líneas de cuadrícula horizontales y labels de ambos ejes Y */}
                    {gridTicks.map((t, idx) => (
                        <g key={idx}>
                            <line
                                x1={margin.left}
                                x2={margin.left + innerWidth}
                                y1={t.y}
                                y2={t.y}
                                stroke="hsl(var(--border))"
                                strokeDasharray="4 4"
                                strokeOpacity={0.5}
                            />
                            {/* Tick izquierdo (Y1) */}
                            <line
                                x1={margin.left - 4}
                                x2={margin.left}
                                y1={t.y}
                                y2={t.y}
                                stroke="hsl(var(--border))"
                                strokeWidth={1}
                                strokeOpacity={0.8}
                            />
                            <text
                                x={margin.left - 8}
                                y={t.y + 3.5}
                                textAnchor="end"
                                fontSize={9}
                                className="fill-muted-foreground font-mono"
                            >
                                {formatValue(t.valLeft, leftAxisFormat)}
                            </text>
                            {/* Tick derecho (Y2) */}
                            <line
                                x1={margin.left + innerWidth}
                                x2={margin.left + innerWidth + 4}
                                y1={t.y}
                                y2={t.y}
                                stroke="hsl(var(--border))"
                                strokeWidth={1}
                                strokeOpacity={0.8}
                            />
                            <text
                                x={margin.left + innerWidth + 8}
                                y={t.y + 3.5}
                                textAnchor="start"
                                fontSize={9}
                                className="fill-muted-foreground font-mono"
                            >
                                {formatValue(t.valRight, rightAxisFormat)}
                            </text>
                        </g>
                    ))}

                    {/* Labels del Eje X */}
                    {periods.map((period, i) => {
                        const x = scaleX(i)
                        return (
                            <text
                                key={period}
                                x={x}
                                y={margin.top + innerHeight + 18}
                                textAnchor="middle"
                                className={cn(
                                    "text-3xs font-medium transition-colors",
                                    hoverIndex === i ? "fill-foreground font-bold" : "fill-muted-foreground",
                                )}
                            >
                                {period}
                            </text>
                        )
                    })}

                    {/* Renderizado de Columnas (Modo bar-line para series del eje derecho) */}
                    {mode === "bar-line" && activeRightSeries.length > 0 && periods.length > 0 && (
                        <g clipPath={`url(#chart-clip-${chartId})`}>
                            {periods.map((period, pIdx) => {
                                const groupCenterX = scaleX(pIdx)
                                const totalColGroupW = (innerWidth / periods.length) * 0.55
                                const colWidth = Math.max(3, totalColGroupW / activeRightSeries.length)
                                const startX = groupCenterX - totalColGroupW / 2

                                return (
                                    <g key={period}>
                                        {activeRightSeries.map((s, sIdx) => {
                                            const val = seriesValuesMap.get(s.id)?.get(period) ?? 0
                                            const colX = startX + sIdx * colWidth
                                            const colY = scaleY2(val)
                                            const colH = Math.max(0, margin.top + innerHeight - colY)

                                            return (
                                                <rect
                                                    key={s.id}
                                                    x={colX}
                                                    y={colY}
                                                    width={Math.max(2, colWidth - 2)}
                                                    height={colH}
                                                    fill={s.color}
                                                    rx={2}
                                                    opacity={hoverIndex === pIdx || hoverIndex === null ? 0.75 : 0.35}
                                                    className="transition-opacity duration-150"
                                                />
                                            )
                                        })}
                                    </g>
                                )
                            })}
                        </g>
                    )}

                    {/* Renderizado de Líneas para Eje Derecho (en modo line-line) */}
                    {mode === "line-line" && activeRightSeries.length > 0 && (
                        <g clipPath={`url(#chart-clip-${chartId})`}>
                            {activeRightSeries.map((s) => {
                                const points = periods.map((p, idx) => ({
                                    x: scaleX(idx),
                                    y: scaleY2(seriesValuesMap.get(s.id)?.get(p) ?? 0),
                                }))
                                const pathD = points.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")

                                return (
                                    <g key={s.id}>
                                        <path
                                            d={pathD}
                                            fill="none"
                                            stroke={s.color}
                                            strokeWidth={2.5}
                                            strokeDasharray="5 3"
                                            opacity={0.85}
                                        />
                                        {points.map((pt, idx) => (
                                            <circle
                                                key={idx}
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={hoverIndex === idx ? 5 : 3.5}
                                                fill={s.color}
                                                stroke="hsl(var(--card))"
                                                strokeWidth={1.5}
                                            />
                                        ))}
                                    </g>
                                )
                            })}
                        </g>
                    )}

                    {/* Renderizado de Líneas para Eje Izquierdo (Precios) */}
                    {activeLeftSeries.length > 0 && (
                        <g clipPath={`url(#chart-clip-${chartId})`}>
                            {activeLeftSeries.map((s) => {
                                const points = periods.map((p, idx) => ({
                                    x: scaleX(idx),
                                    y: scaleY1(seriesValuesMap.get(s.id)?.get(p) ?? 0),
                                }))
                                const pathD = points.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")

                                return (
                                    <g key={s.id}>
                                        <path
                                            d={pathD}
                                            fill="none"
                                            stroke={s.color}
                                            strokeWidth={3}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        {points.map((pt, idx) => (
                                            <circle
                                                key={idx}
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={hoverIndex === idx ? 5.5 : 4}
                                                fill={s.color}
                                                stroke="hsl(var(--card))"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </g>
                                )
                            })}
                        </g>
                    )}

                    {/* Crosshair vertical en hover */}
                    {hoverIndex !== null && periods[hoverIndex] && (
                        <line
                            x1={scaleX(hoverIndex)}
                            x2={scaleX(hoverIndex)}
                            y1={margin.top}
                            y2={margin.top + innerHeight}
                            stroke="hsl(var(--foreground))"
                            strokeWidth={1}
                            strokeOpacity={0.35}
                            strokeDasharray="3 3"
                        />
                    )}
                </svg>

                {/* Tooltip unificado flotante */}
                {hoverIndex !== null && periods[hoverIndex] && (
                    <div
                        className="pointer-events-none absolute z-20 min-w-52 rounded-lg border border-border bg-card p-3 text-xs shadow-lg transition-all duration-75"
                        style={{
                            left: Math.min(
                                Math.max(10, scaleX(hoverIndex) - 105),
                                dimensions.width - 220,
                            ),
                            top: margin.top + 8,
                        }}
                    >
                        <div className="mb-2 flex items-center justify-between border-b border-border/80 pb-1.5">
                            <span className="font-semibold text-foreground">{periods[hoverIndex]}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-3xs font-mono text-muted-foreground">
                                Período
                            </span>
                        </div>

                        {activeLeftSeries.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {leftAxisLabel ?? "Precios (Eje Y1)"}
                                </span>
                                {activeLeftSeries.map((s) => {
                                    const val = seriesValuesMap.get(s.id)?.get(periods[hoverIndex]) ?? 0
                                    return (
                                        <div key={s.id} className="flex items-center justify-between gap-3 text-2xs">
                                            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                                                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                                                <span className="truncate">{s.label}:</span>
                                            </span>
                                            <strong className="font-mono text-foreground shrink-0">
                                                {formatValue(val, leftAxisFormat)}
                                            </strong>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {activeRightSeries.length > 0 && (
                            <div className="mt-2 space-y-1 border-t border-border/60 pt-1.5">
                                <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {rightAxisLabel ?? "Ventas (Eje Y2)"}
                                </span>
                                {activeRightSeries.map((s) => {
                                    const val = seriesValuesMap.get(s.id)?.get(periods[hoverIndex]) ?? 0
                                    return (
                                        <div key={s.id} className="flex items-center justify-between gap-3 text-2xs">
                                            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                                                <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: s.color }} />
                                                <span className="truncate">{s.label}:</span>
                                            </span>
                                            <strong className="font-mono text-foreground shrink-0">
                                                {formatValue(val, rightAxisFormat)}
                                            </strong>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
