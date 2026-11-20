"use client"

import { useMemo, type ReactNode } from "react"
import { AnalyticsChart, Metric, MetricStrip } from "@/components/shared"
import { Collection, formatNumber, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { periodToDateFrom, type PeriodKey } from "./period"
import type { ProductionPerformance } from "./productionPerformance.types"
import { useProductProductionPerformance } from "../hooks/useProductProductionPerformance"
import {
    productionOrderPerformanceEntity, productionOrderPerformanceViews,
} from "../entity-view/productionOrderPerformance.entity"
import {
    productionMaterialPerformanceEntity, productionMaterialPerformanceViews,
} from "../entity-view/productionMaterialPerformance.entity"

const pct = (n: number) => formatNumber(n, 1, "%")
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${pct(n)}`

/** "Fabricación": real cost vs BOM, input deviation, stage times and margin per work order (ADR-0146). */
export function ProductionPerformanceBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const dateFrom = useMemo(() => periodToDateFrom(period), [period])
    const { data, isLoading, isError } = useProductProductionPerformance(productId, { date_from: dateFrom })

    const ordersCollection = useEntityCollection(
        productionOrderPerformanceEntity, { rows: data?.orders ?? [] }, { pagination: { mode: "none" } },
    )
    const materialsCollection = useEntityCollection(
        productionMaterialPerformanceEntity, { rows: data?.materials ?? [] }, { pagination: { mode: "none" } },
    )

    const orders = (
        <Collection.Root collection={ordersCollection}>
            <Collection.View table={productionOrderPerformanceViews.table} emptyTitle="Sin OT" emptyDescription="No hay OT terminadas en el periodo." />
        </Collection.Root>
    )
    const materials = (
        <Collection.Root collection={materialsCollection}>
            <Collection.View table={productionMaterialPerformanceViews.table} emptyTitle="Sin consumos" emptyDescription="Las OT del periodo no registran consumos." />
        </Collection.Root>
    )

    return (
        <AnalyticsBlockFrame
            isLoading={isLoading}
            isError={isError || !data}
            errorMessage="No se pudo cargar el rendimiento de fabricación."
            isEmpty={!!data && data.kpis.orders === 0}
            emptyMessage="Sin OT terminadas en el periodo"
        >
            {data && <ProductionPerformanceBody data={data} orders={orders} materials={materials} />}
        </AnalyticsBlockFrame>
    )
}

function ProductionPerformanceBody({
    data, orders, materials,
}: { data: ProductionPerformance; orders: ReactNode; materials: ReactNode }) {
    const k = data.kpis
    const hasEstimated = data.orders.some((o) => o.estimated)
    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <MetricStrip label="Costos de fabricación">
                    <Metric label="Costo real por unidad" value={formatMoney(k.unit_real_cost)} context={k.bom_cost > 0 ? `${signedPct(k.bom_gap_pct)} vs BOM` : "Sin BOM activa"} />
                    <Metric label="Costo BOM actual" value={formatMoney(k.bom_cost)} />
                    <Metric label="Desviación de insumos" value={signedPct(k.deviation_pct)} tone={k.deviation_pct > 0 ? "warning" : "success"} />
                </MetricStrip>
                <MetricStrip label="Tiempos y calidad de fabricación">
                    <Metric label="Lead time" value={k.lead_time_days === null ? "—" : `${formatNumber(k.lead_time_days, 1)} días`} />
                    <Metric label="Rectificación" value={pct(k.rectification_rate)} />
                </MetricStrip>
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
            {orders}
            {materials}
        </div>
    )
}
