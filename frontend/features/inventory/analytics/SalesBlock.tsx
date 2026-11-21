"use client"

import { useMemo, useState, type ReactNode } from "react"
import { LineChart, Metric, MetricStrip } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composeSales } from "./composeSales"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import { RailControls } from "./RailControls"
import type { ProductSales, SalesParams, SalesPoint } from "./sales.types"
import { ViewControl } from "./ViewControl"
import { useProductSales } from "../hooks/useProductSales"
import {
    salesCustomersEntity, salesCustomersViews, salesSharesEntity, salesSharesViews,
} from "../entity-view/salesShare.entity"

type SalesMetric = "units" | "net_revenue"
const METRICS: Array<{ value: SalesMetric; label: string }> = [
    { value: "units", label: "Unidades" },
    { value: "net_revenue", label: "Ingreso neto" },
]
const CHART_MARGIN = { top: 24, right: 16, bottom: 28, left: 64 }
const SERIES_COLORS = ["var(--color-primary)", "var(--color-muted-foreground)"]
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")

/** "Ventas": volume, trend against the previous period, customers and mix by channel / variant / unit. */
export function SalesBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const [metric, setMetric] = useState<SalesMetric>("units")
    const params = useMemo<SalesParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period) }),
        [period],
    )
    const { data, isLoading, isError } = useProductSales(productId, params)
    return (
        <div className="flex flex-col gap-4">
            <RailControls>
                <ViewControl label="Métrica" value={metric} options={METRICS} onChange={setMetric} />
            </RailControls>
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de ventas."
            >
                {data && <SalesBody data={data} metric={metric} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

const seriesPoints = (points: SalesPoint[], metric: SalesMetric) =>
    points.map((p) => ({ x: p.period, y: p[metric] }))

function SalesBody({ data, metric }: { data: ProductSales; metric: SalesMetric }) {
    const composition = composeSales(data)
    const { kpis, customers } = data
    const customersCollection = useEntityCollection(salesCustomersEntity, { rows: customers.top }, { pagination: { mode: "none" } })
    const channelsCollection = useEntityCollection(salesSharesEntity, { rows: data.channels }, { pagination: { mode: "none" } })
    const variantsCollection = useEntityCollection(salesSharesEntity, { rows: data.variants }, { pagination: { mode: "none" } })
    const uomsCollection = useEntityCollection(salesSharesEntity, { rows: data.uoms }, { pagination: { mode: "none" } })

    const metricLabel = METRICS.find((m) => m.value === metric)?.label ?? ""
    const lines = useMemo(() => {
        const current = { id: metricLabel, data: seriesPoints(data.series.points, metric) }
        if (data.series.previous_points.length === 0) return [current]
        return [current, { id: "Período anterior", data: seriesPoints(data.series.previous_points, metric) }]
    }, [data.series, metric, metricLabel])

    const unitsDelta = kpis.previous && kpis.previous.units > 0
        ? { current: kpis.units, previous: kpis.previous.units }
        : undefined
    const section = (id: string, title: string, body: ReactNode, note?: string) => (
        <section key={id} aria-label={id} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {body}
        </section>
    )
    const table = (collection: typeof channelsCollection, empty: string) => (
        <Collection.Root collection={collection}>
            <Collection.View table={salesSharesViews.table} emptyTitle={empty} emptyDescription="Sin ventas para este reparto." />
        </Collection.Root>
    )

    return (
        <div className="flex flex-col gap-4">
            {composition.findings.length > 0 && (
                <ul aria-label="Hallazgos" className="flex flex-col gap-2">
                    {composition.findings.map((finding) => (
                        <li key={finding.id} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                            {finding.message}
                        </li>
                    ))}
                </ul>
            )}
            <MetricStrip label="Resultado del periodo">
                <Metric label="Unidades vendidas" value={kpis.units} delta={unitsDelta} context={kpis.previous ? `Antes: ${kpis.previous.units}` : undefined} />
                <Metric label="Ingreso neto" value={formatMoney(kpis.net_revenue)} />
                <Metric label="Clientes" value={kpis.customers} context={customers.total > 3 ? `Top 3: ${customers.top3_share_pct.toFixed(0)} %` : undefined} />
                <Metric label="Devoluciones" value={kpis.return_units} context={`${kpis.return_rate_pct.toFixed(1)} % de lo vendido`} />
            </MetricStrip>
            {kpis.last_sale_date && (
                <p className="text-xs text-muted-foreground">
                    Última venta hace {kpis.days_since_last_sale} días ({formatIsoDate(kpis.last_sale_date)})
                </p>
            )}
            {composition.sections.length === 0 && (
                <p className="text-sm italic text-muted-foreground">Sin ventas en el periodo</p>
            )}
            {composition.sections.map((name) => {
                switch (name) {
                    case "chart":
                        return section("Evolución", `${metricLabel} por periodo`, (
                            <div className="h-64 min-h-0">
                                <LineChart
                                    data={lines}
                                    margin={CHART_MARGIN}
                                    colors={SERIES_COLORS}
                                    tooltipFormat={metric === "net_revenue" ? "currency" : "number"}
                                    enableArea={false}
                                    pointSize={4}
                                    axisBottom={{ tickSize: 0, tickPadding: 8 }}
                                    axisLeft={{ tickSize: 0, tickPadding: 8 }}
                                    ariaLabel={`${metricLabel} por periodo, con el período anterior superpuesto`}
                                />
                            </div>
                        ))
                    case "customers":
                        return section("Clientes", "Mejores clientes", (
                            <Collection.Root collection={customersCollection}>
                                <Collection.View table={salesCustomersViews.table} emptyTitle="Sin clientes" emptyDescription="Sin ventas a clientes en el periodo." />
                            </Collection.Root>
                        ))
                    case "channels":
                        return section("Canales", "Por canal", table(channelsCollection, "Sin canales"))
                    case "variants":
                        return section("Variantes", "Por variante", table(variantsCollection, "Sin variantes"))
                    case "uoms":
                        return section("Unidades de medida", "Por unidad de medida", table(uomsCollection, "Sin unidades"))
                }
            })}
        </div>
    )
}
