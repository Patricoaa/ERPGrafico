"use client"

import { useMemo, useState } from "react"
import { AnalyticsChart, StatCard } from "@/components/shared"
import { Collection, formatNumber, useEntityCollection } from "@/components/entity-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMoney } from "@/lib/money"
import { useProductProductionPerformance } from "../hooks/useProductProductionPerformance"
import {
    productionOrderPerformanceEntity, productionOrderPerformanceViews,
} from "../entity-view/productionOrderPerformance.entity"
import {
    productionMaterialPerformanceEntity, productionMaterialPerformanceViews,
} from "../entity-view/productionMaterialPerformance.entity"

const RANGES = [{ months: 3, label: "3 m" }, { months: 12, label: "12 m" }, { months: 24, label: "24 m" }]

/** Local-date ISO (yyyy-mm-dd), clamped to the last day of the target month (no overflow). */
function monthsAgoIso(months: number, today = new Date()): string {
    const target = new Date(today.getFullYear(), today.getMonth() - months, 1)
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    target.setDate(Math.min(today.getDate(), lastDay))
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
}

const pct = (n: number) => formatNumber(n, 1, "%")
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${pct(n)}`

/** "Fabricación": real cost vs BOM, input deviation, stage times and margin per work order (ADR-0146). */
export function ProductionPerformanceBlock({ productId }: { productId: number }) {
    const [rangeMonths, setRangeMonths] = useState(12)
    const dateFrom = useMemo(() => monthsAgoIso(rangeMonths), [rangeMonths])
    const { data, isLoading, isError } = useProductProductionPerformance(productId, { date_from: dateFrom })

    const ordersCollection = useEntityCollection(
        productionOrderPerformanceEntity, { rows: data?.orders ?? [] }, { pagination: { mode: "none" } },
    )
    const materialsCollection = useEntityCollection(
        productionMaterialPerformanceEntity, { rows: data?.materials ?? [] }, { pagination: { mode: "none" } },
    )

    const control = (
        <div className="flex flex-col gap-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Rango</p>
            <ToggleGroup
                type="single"
                value={String(rangeMonths)}
                onValueChange={(v) => v && setRangeMonths(Number(v))}
                aria-label="Rango"
                className="justify-start gap-1"
            >
                {RANGES.map((r) => (
                    <ToggleGroupItem
                        key={r.months}
                        value={String(r.months)}
                        size="sm"
                        className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        {r.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    )

    let body: React.ReactNode
    if (isLoading) {
        body = <p role="status" className="text-sm text-muted-foreground">Cargando rendimiento de fabricación…</p>
    } else if (isError || !data) {
        body = <p role="alert" className="text-sm text-destructive">No se pudo cargar el rendimiento de fabricación.</p>
    } else if (data.kpis.orders === 0) {
        body = <p className="text-sm text-muted-foreground italic">Sin OT terminadas en el periodo</p>
    } else {
        const k = data.kpis
        const hasEstimated = data.orders.some((o) => o.estimated)
        body = (
            <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <StatCard
                        label="Costo real por unidad" valueSize="xl" accent="primary"
                        value={formatMoney(k.unit_real_cost)}
                        subtext={k.bom_cost > 0 ? `${signedPct(k.bom_gap_pct)} vs BOM` : "Sin BOM activa"}
                    />
                    <StatCard label="Costo BOM actual" valueSize="xl" accent="info" value={formatMoney(k.bom_cost)} />
                    <StatCard label="Desviación de insumos" valueSize="xl" accent={k.deviation_pct > 0 ? "warning" : "success"} value={signedPct(k.deviation_pct)} />
                    <StatCard label="Lead time" valueSize="xl" accent="info" value={k.lead_time_days === null ? "—" : `${formatNumber(k.lead_time_days, 1)} días`} />
                    <StatCard label="Rectificación" valueSize="xl" accent="info" value={pct(k.rectification_rate)} />
                </div>
                {hasEstimated && (
                    <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                        Algunas OT usan costo estimado: tienen consumos sin movimiento de stock y se valoraron al costo actual del insumo.
                    </p>
                )}
                {data.stages.length > 0 && (
                    <div className="h-64 min-h-0">
                        <AnalyticsChart
                            type="bar-chart" preset="card" indexBy="label" keys={["Días promedio"]}
                            data={data.stages.map((s) => ({ label: s.label, "Días promedio": Number(s.avg_days.toFixed(1)) }))}
                        />
                    </div>
                )}
                <Collection.Root collection={ordersCollection}>
                    <Collection.View table={productionOrderPerformanceViews.table} emptyTitle="Sin OT" emptyDescription="No hay OT terminadas en el periodo." />
                </Collection.Root>
                <Collection.Root collection={materialsCollection}>
                    <Collection.View table={productionMaterialPerformanceViews.table} emptyTitle="Sin consumos" emptyDescription="Las OT del periodo no registran consumos." />
                </Collection.Root>
            </>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {control}
            {body}
        </div>
    )
}
