"use client"

import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, LineChart, SkeletonShell } from "@/components/shared"
import type { PartnerEquityStake } from "@/features/contacts"
import { formatDateWith, formatPlainDate } from "@/lib/utils"
import { usePartnerStakes } from "../hooks"

export interface ParticipationPoint {
    /** Fecha ISO (`YYYY-MM-DD`) en que rige el porcentaje. */
    x: string
    y: number
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/**
 * Un punto por cada cambio de participación (inicio de cada vigencia) y uno de cierre en la última fecha
 * conocida (hoy si sigue vigente). No hay periodo fijo: la serie abarca exactamente el rango de los registros.
 */
export function participationSeries(stakes: PartnerEquityStake[], today: string = isoDate(new Date())): ParticipationPoint[] {
    if (stakes.length === 0) return []
    const ordered = [...stakes].sort((a, b) => a.effective_from.localeCompare(b.effective_from) || a.id - b.id)
    const byDate = new Map<string, number>()
    for (const stake of ordered) byDate.set(stake.effective_from, Number(stake.percentage) || 0)
    const points = [...byDate].map(([x, y]) => ({ x, y }))
    const last = ordered[ordered.length - 1]
    const end = last.effective_until ?? (last.is_active ? today : last.effective_from)
    const tail = points[points.length - 1]
    if (end > tail.x) points.push({ x: end, y: tail.y })
    return points
}

/** Formato de las marcas del eje según el rango: días si cabe en un año, meses hasta cinco años, años más allá. */
export function participationAxisFormat(points: ParticipationPoint[]): Intl.DateTimeFormatOptions {
    const days = (Date.parse(points[points.length - 1].x) - Date.parse(points[0].x)) / 86_400_000
    if (days <= 366) return { day: "2-digit", month: "short" }
    if (days <= 366 * 5) return { month: "short", year: "2-digit" }
    return { year: "numeric" }
}

/** Evolución de la participación del socio en el periodo que cubren sus vigencias (`partnerStake`). */
export function PartnerParticipationHistory({ partnerId }: { partnerId: number }) {
    const { data: stakes = [], isLoading, isError, refetch } = usePartnerStakes(partnerId)
    const points = useMemo(() => participationSeries(stakes), [stakes])
    const axisFormat = useMemo(() => (points.length > 1 ? participationAxisFormat(points) : {}), [points])

    if (isError) {
        return (
            <EmptyState
                icon={AlertTriangle}
                context="generic"
                title="No pudimos cargar la participación"
                description="Revisa tu conexión e intenta nuevamente."
                variant="compact"
                action={<Button variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>}
            />
        )
    }

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando participación histórica">
            {points.length > 1 ? (
                <div className="h-52">
                    <LineChart
                        data={[{ id: "Participación", data: points }]}
                        colors={["var(--primary)"]}
                        margin={{ top: 12, right: 16, bottom: 32, left: 44 }}
                        yScale={{ type: "linear", min: 0, max: "auto", stacked: false, reverse: false }}
                        axisBottom={{ tickSize: 0, tickPadding: 10, format: (v: string) => formatDateWith(v, axisFormat) }}
                        axisLeft={{ tickSize: 0, tickPadding: 8, format: (v: number) => `${v}%` }}
                        enableGridX={false}
                        legends={[]}
                        renderTooltip={({ data }) => (
                            <div className="flex items-center gap-2">
                                <span className="font-medium tabular-nums">{formatPlainDate(String(data.x))}</span>
                                <span className="text-sm font-normal tabular-nums">{Number(data.y).toFixed(1)}%</span>
                            </div>
                        )}
                        ariaLabel={`Evolución de la participación: ${points.map(p => `${formatPlainDate(p.x)} ${p.y}%`).join(", ")}`}
                    />
                </div>
            ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    La participación aún no tiene evolución registrada.
                </p>
            )}
        </SkeletonShell>
    )
}
