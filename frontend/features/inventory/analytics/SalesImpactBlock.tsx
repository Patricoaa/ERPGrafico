"use client"

import { useMemo, useState, type ReactNode } from "react"
import { AnalyticsChart } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import { RailControls } from "./RailControls"
import { ViewControl } from "./ViewControl"
import { useProductSalesImpact } from "../hooks/useProductSalesImpact"
import { salesImpactEntity, salesImpactViews } from "../entity-view/salesImpact.entity"
import type {
    SalesImpact, SalesImpactGroupBy, SalesImpactMetric, SalesImpactParams,
} from "./salesImpact.types"

const METRICS: Array<{ value: SalesImpactMetric; label: string }> = [
    { value: "net_revenue", label: "Ingreso neto" },
    { value: "units", label: "Unidades" },
    { value: "margin", label: "Margen" },
    { value: "avg_price", label: "Precio medio" },
    { value: "discount_total", label: "Descuento" },
    { value: "foregone_revenue", label: "No percibido" },
]
const GROUPS: Array<{ value: SalesImpactGroupBy; label: string }> = [
    { value: "rule", label: "Regla" },
    { value: "channel", label: "Canal" },
    { value: "customer", label: "Cliente" },
    { value: "variant", label: "Variante" },
    { value: "uom", label: "Unidad" },
]
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")

/** "Precio y margen": segmentable sales/margin chart, price-rule windows and segment table (ADR-0145). */
export function SalesImpactBlock({
    productId, period, defaultGroupBy = "rule",
}: { productId: number; period: PeriodKey; defaultGroupBy?: SalesImpactGroupBy }) {
    const [metric, setMetric] = useState<SalesImpactMetric>("net_revenue")
    const [groupBy, setGroupBy] = useState<SalesImpactGroupBy>(defaultGroupBy)

    const dateFrom = useMemo(() => periodToDateFrom(period), [period])
    const granularity = periodToGranularity(period)
    const params: SalesImpactParams = { metric, group_by: groupBy, granularity, date_from: dateFrom }
    const { data, isLoading, isError } = useProductSalesImpact(productId, params)

    const tableCollection = useEntityCollection(
        salesImpactEntity,
        { rows: data?.table ?? [] },
        { pagination: { mode: "none" } },
    )

    const chart = useMemo(() => {
        if (!data) return { keys: [] as string[], rows: [] as Array<Record<string, string | number>> }
        const keys = data.segments.map((s) => s.label)
        const rows = data.series.map((point) => {
            const row: Record<string, string | number> = { period: point.period }
            for (const segment of data.segments) row[segment.label] = point.segments[segment.key] ?? 0
            return row
        })
        return { keys, rows }
    }, [data])

    const controls = (
        <>
            <ViewControl label="Métrica" value={metric} options={METRICS} onChange={setMetric} />
            <ViewControl label="Agrupar por" value={groupBy} options={GROUPS} onChange={setGroupBy} />
        </>
    )

    const table = (
        <Collection.Root collection={tableCollection}>
            <Collection.View frame="card" table={salesImpactViews.table} emptyTitle="Sin ventas en el periodo" emptyDescription="No hay ventas confirmadas para este producto." />
        </Collection.Root>
    )

    return (
        <div className="flex flex-col gap-4">
            <RailControls>{controls}</RailControls>
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de precio y margen."
                isEmpty={!!data && data.totals.units === 0 && data.table.length === 0}
                emptyMessage="Sin ventas en el periodo"
            >
                {data && <SalesImpactBody data={data} chart={chart} table={table} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

function SalesImpactBody({
    data, chart, table,
}: {
    data: SalesImpact
    chart: { keys: string[]; rows: Array<Record<string, string | number>> }
    table: ReactNode
}) {
    const coverage = data.coverage
    return (
        <div className="flex flex-col gap-4">
            <div className="h-72 min-h-0">
                <AnalyticsChart type="bar-chart" preset="card" data={chart.rows} keys={chart.keys} indexBy="period" showLegend />
            </div>
            {Math.round(coverage.revenue_with_provenance_pct) < 100 && (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                    El {Math.round(coverage.revenue_with_provenance_pct)} % del ingreso del periodo tiene regla registrada
                    {coverage.since ? ` (desde ${formatIsoDate(coverage.since)})` : ""}. El resto se agrupa como «Sin registro».
                </p>
            )}
            {data.returns.units > 0 && (
                <p className="text-xs text-muted-foreground">
                    Devoluciones: {data.returns.units} un · {formatMoney(data.returns.revenue)} (no incluidas en la serie)
                </p>
            )}
            {data.rule_windows.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Vigencia de reglas de precio">
                    {data.rule_windows.map((rule) => (
                        <li key={rule.rule_id} className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            {rule.name} · {rule.start ? formatIsoDate(rule.start) : "sin inicio"} → {rule.end ? formatIsoDate(rule.end) : "sin fin"}
                        </li>
                    ))}
                </ul>
            )}
            {table}
            <p className="text-xs text-muted-foreground">
                La comparación entre reglas es una asociación, no causalidad: no demuestra que la regla provocó la venta.
            </p>
        </div>
    )
}
