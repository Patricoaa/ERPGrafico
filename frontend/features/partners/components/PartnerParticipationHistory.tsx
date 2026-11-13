"use client"

import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, LineChart, SkeletonShell } from "@/components/shared"
import type { PartnerEquityStake } from "@/features/contacts"
import { usePartnerStakes } from "../hooks"

export interface ParticipationPoint {
    x: string
    y: number
}

/**
 * Un punto por ejercicio con la participación vigente al cierre del año, desde la primera vigencia hasta
 * el último ejercicio con vigencia abierta (o el actual si sigue activa). Sin vigencias, sin serie.
 */
export function annualParticipationSeries(stakes: PartnerEquityStake[], currentYear = new Date().getFullYear()): ParticipationPoint[] {
    if (stakes.length === 0) return []
    const ordered = [...stakes].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    const startYear = Number(ordered[0].effective_from.slice(0, 4))
    const lastYear = Math.max(...ordered.map(s => Number((s.effective_until ?? s.effective_from).slice(0, 4))))
    const endYear = ordered.some(s => s.is_active) ? Math.max(lastYear, currentYear) : lastYear
    const points: ParticipationPoint[] = []
    for (let year = startYear; year <= endYear; year += 1) {
        const yearEnd = `${year}-12-31`
        const yearStart = `${year}-01-01`
        const vigente = ordered.filter(s => s.effective_from <= yearEnd && (!s.effective_until || s.effective_until >= yearStart))
        const stake = vigente[vigente.length - 1]
        if (stake) points.push({ x: String(year), y: Number(stake.percentage) || 0 })
    }
    return points
}

/** Evolución anual de la participación del socio, a partir de sus vigencias (`partnerStake`). */
export function PartnerParticipationHistory({ partnerId }: { partnerId: number }) {
    const { data: stakes = [], isLoading, isError, refetch } = usePartnerStakes(partnerId)
    const points = useMemo(() => annualParticipationSeries(stakes), [stakes])

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
                        axisBottom={{ tickSize: 0, tickPadding: 10 }}
                        axisLeft={{ tickSize: 0, tickPadding: 8, format: (v: number) => `${v}%` }}
                        enableGridX={false}
                        legends={[]}
                        renderTooltip={({ data }) => (
                            <div className="flex items-center gap-2">
                                <span className="font-medium tabular-nums">{String(data.xFormatted ?? data.x)}</span>
                                <span className="text-sm font-normal tabular-nums">{Number(data.y).toFixed(1)}%</span>
                            </div>
                        )}
                        ariaLabel={`Evolución anual de la participación: ${points.map(p => `${p.x} ${p.y}%`).join(", ")}`}
                    />
                </div>
            ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    La participación aún no tiene evolución anual registrada.
                </p>
            )}
        </SkeletonShell>
    )
}
