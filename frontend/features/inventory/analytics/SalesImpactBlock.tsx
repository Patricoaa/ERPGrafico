"use client"

import { useMemo, useState, type ReactNode } from "react"
import { AnalyticsChart } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { periodToDateFrom, type PeriodKey } from "./period"
import { useProductSalesImpact } from "../hooks/useProductSalesImpact"
import { salesImpactEntity, salesImpactViews } from "../entity-view/salesImpact.entity"
import type {
    SalesImpact, SalesImpactGranularity, SalesImpactGroupBy, SalesImpactMetric, SalesImpactParams,
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
const GRANULARITIES: Array<{ value: SalesImpactGranularity; label: string }> = [
    { value: "day", label: "Día" },
    { value: "month", label: "Mes" },
    { value: "year", label: "Año" },
]
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")

function ControlGroup<T extends string | number>({
    label, value, options, onChange,
}: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <ToggleGroup
                type="single"
                value={String(value)}
                onValueChange={(v) => {
                    const next = options.find((o) => String(o.value) === v)
                    if (next) onChange(next.value)
                }}
                aria-label={label}
                className="flex-wrap justify-start gap-1"
            >
                {options.map((o) => (
                    <ToggleGroupItem
                        key={String(o.value)}
                        value={String(o.value)}
                        size="sm"
                        className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        {o.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    )
}

/** "Precio y margen": segmentable sales/margin chart, price-rule windows and segment table (ADR-0145). */
export function SalesImpactBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const [metric, setMetric] = useState<SalesImpactMetric>("net_revenue")
    const [groupBy, setGroupBy] = useState<SalesImpactGroupBy>("rule")
    const [granularity, setGranularity] = useState<SalesImpactGranularity>("month")

    const dateFrom = useMemo(() => periodToDateFrom(period), [period])
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
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <ControlGroup label="Métrica" value={metric} options={METRICS} onChange={setMetric} />
            <ControlGroup label="Agrupar por" value={groupBy} options={GROUPS} onChange={setGroupBy} />
            <ControlGroup label="Por" value={granularity} options={GRANULARITIES} onChange={setGranularity} />
        </div>
    )

    const table = (
        <Collection.Root collection={tableCollection}>
            <Collection.View table={salesImpactViews.table} emptyTitle="Sin ventas en el periodo" emptyDescription="No hay ventas confirmadas para este producto." />
        </Collection.Root>
    )

    return (
        <div className="flex flex-col gap-4">
            {controls}
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
