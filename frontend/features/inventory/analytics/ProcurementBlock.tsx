"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChartSection, LineChart, Metric, MetricStrip } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composeProcurement } from "./composeProcurement"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import type { ProcurementParams, ProcurementPoint, ProductProcurement } from "./procurement.types"
import { RailControls } from "./RailControls"
import { ViewControl } from "./ViewControl"
import { useProductProcurement } from "../hooks/useProductProcurement"
import {
    procurementPendingEntity, procurementPendingViews, procurementSuppliersEntity, procurementSuppliersViews,
    type ProcurementSupplierTableRow,
} from "../entity-view/procurement.entity"

type ProcurementMetric = "units" | "spend"
const METRICS: Array<{ value: ProcurementMetric; label: string }> = [
    { value: "units", label: "Unidades" },
    { value: "spend", label: "Gasto" },
]
const CHART_MARGIN = { top: 24, right: 16, bottom: 28, left: 64 }
const SERIES_COLORS = ["var(--color-primary)", "var(--color-muted-foreground)"]
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")
const round2 = (value: number) => Number(value.toFixed(2))

/** "Abastecimiento": coverage, purchases against the previous period, suppliers and pending receipts. */
export function ProcurementBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const [metric, setMetric] = useState<ProcurementMetric>("units")
    const params = useMemo<ProcurementParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period) }),
        [period],
    )
    const { data, isLoading, isError } = useProductProcurement(productId, params)
    return (
        <div className="flex flex-col gap-4">
            <RailControls>
                <ViewControl label="Métrica" value={metric} options={METRICS} onChange={setMetric} />
            </RailControls>
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de abastecimiento."
            >
                {data && <ProcurementBody data={data} metric={metric} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

const seriesPoints = (points: ProcurementPoint[], metric: ProcurementMetric) =>
    points.map((p) => ({ x: p.period, y: p[metric] }))

function ProcurementBody({ data, metric }: { data: ProductProcurement; metric: ProcurementMetric }) {
    const composition = composeProcurement(data)
    const { kpis, coverage } = data
    const supplierRows = useMemo<ProcurementSupplierTableRow[]>(
        () => data.suppliers.map(({ preferred, ...row }) => ({ ...row, preferred_label: preferred ? "Preferido" : "" })),
        [data.suppliers],
    )
    const suppliersCollection = useEntityCollection(procurementSuppliersEntity, { rows: supplierRows }, { pagination: { mode: "none" } })
    const pendingCollection = useEntityCollection(procurementPendingEntity, { rows: data.pending }, { pagination: { mode: "none" } })

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
    const hasPurchases = data.series.points.length > 0

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
            {coverage && (
                <MetricStrip label="Cobertura de stock">
                    <Metric
                        label="Cobertura"
                        value={coverage.coverage_days === null ? null : Math.round(coverage.coverage_days)}
                        unit="días"
                        context={coverage.daily_out > 0
                            ? `Consumo: ${round2(coverage.daily_out)} un/día (últimos 90 días)`
                            : "Sin salidas en los últimos 90 días"}
                    />
                    <Metric label="Stock actual" value={round2(coverage.stock_now)} unit="un" />
                </MetricStrip>
            )}
            <MetricStrip label="Compras del periodo">
                <Metric label="Unidades compradas" value={round2(kpis.units)} delta={unitsDelta} />
                <Metric label="Gasto" value={formatMoney(kpis.spend)} />
                <Metric label="Órdenes" value={kpis.orders} />
                <Metric label="Proveedores" value={kpis.suppliers} />
            </MetricStrip>
            {kpis.last_purchase_date && (
                <p className="text-xs text-muted-foreground">
                    Última compra hace {kpis.days_since_last_purchase} días ({formatIsoDate(kpis.last_purchase_date)})
                </p>
            )}
            {!hasPurchases && <p className="text-sm italic text-muted-foreground">Sin compras en el periodo</p>}
            {composition.sections.map((name) => {
                switch (name) {
                    case "chart":
                        return (
                            <ChartSection key="Evolución" title={`${metricLabel} por periodo`} label="Evolución">
                            <div className="h-64 min-h-0">
                                <LineChart
                                    data={lines}
                                    margin={CHART_MARGIN}
                                    colors={SERIES_COLORS}
                                    tooltipFormat={metric === "spend" ? "currency" : "number"}
                                    enableArea={false}
                                    pointSize={4}
                                    axisBottom={{ tickSize: 0, tickPadding: 8 }}
                                    axisLeft={{ tickSize: 0, tickPadding: 8 }}
                                    ariaLabel={`${metricLabel} comprado por periodo, con el período anterior superpuesto`}
                                />
                            </div>
                                                    </ChartSection>
                        )
                    case "suppliers":
                        return section("Proveedores", "Proveedores", (
                            <Collection.Root collection={suppliersCollection}>
                                <Collection.View frame="card" table={procurementSuppliersViews.table} emptyTitle="Sin proveedores" emptyDescription="No hubo compras en el periodo." />
                            </Collection.Root>
                        ))
                    case "pending":
                        return section("Pendiente de recibir", "Pendiente de recibir", (
                            <Collection.Root collection={pendingCollection}>
                                <Collection.View frame="card" table={procurementPendingViews.table} emptyTitle="Nada pendiente" emptyDescription="No hay órdenes confirmadas por recibir." />
                            </Collection.Root>
                        ), "Órdenes confirmadas con cantidad aún sin recibir, sin importar el periodo.")
                    default:
                        return null
                }
            })}
        </div>
    )
}
