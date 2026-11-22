"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChartSection, LineChart, Metric, MetricStrip } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composeProduction } from "./composeProduction"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import type { IncreasePct, ProductionAnalysisParams, ProductProductionAnalysis } from "./productionAnalysis.types"
import { RailControls } from "./RailControls"
import { ViewControl } from "./ViewControl"
import { useProductProductionAnalysis } from "../hooks/useProductProductionAnalysis"
import {
    inputByProductEntity, inputByProductViews, inputUsedInEntity, inputUsedInViews, madeMaterialsEntity,
    madeMaterialsViews, madeOrdersEntity, madeOrdersViews, type MadeOrderRow,
} from "../entity-view/productionAnalysis.entity"

const INCREASES: Array<{ value: IncreasePct; label: string }> = [
    { value: 5, label: "5 %" }, { value: 10, label: "10 %" }, { value: 20, label: "20 %" },
]
const CHART_MARGIN = { top: 24, right: 16, bottom: 28, left: 64 }
const SERIES_COLORS = ["var(--color-primary)", "var(--color-muted-foreground)"]
const round2 = (value: number) => Number(value.toFixed(2))

/** "Producción": the product as manufactured (orders, rework, inputs) and as input (consumption, BOM usage). */
export function ProductionBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const [increase, setIncrease] = useState<IncreasePct>(10)
    const params = useMemo<ProductionAnalysisParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period), increase_pct: increase }),
        [period, increase],
    )
    const { data, isLoading, isError } = useProductProductionAnalysis(productId, params)
    return (
        <div className="flex flex-col gap-4">
            {data?.input && (
                <RailControls>
                    <ViewControl label="Subida de precio del insumo" value={increase} options={INCREASES} onChange={setIncrease} />
                </RailControls>
            )}
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de producción."
            >
                {data && <ProductionBody data={data} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

function ProductionBody({ data }: { data: ProductProductionAnalysis }) {
    const composition = composeProduction(data)
    const { made, input } = data
    const pagination = { pagination: { mode: "none" as const } }
    const orderRows = useMemo<MadeOrderRow[]>(
        () => (made?.orders ?? []).map((o) => ({ number: o.number, date: o.date, units: o.units, status: o.rectified ? "Rectificada" : "" })),
        [made],
    )
    const materialsCollection = useEntityCollection(madeMaterialsEntity, { rows: made?.materials ?? [] }, pagination)
    const ordersCollection = useEntityCollection(madeOrdersEntity, { rows: orderRows }, pagination)
    const byProductCollection = useEntityCollection(inputByProductEntity, { rows: input?.by_product ?? [] }, pagination)
    const usedInCollection = useEntityCollection(inputUsedInEntity, { rows: input?.used_in.parents ?? [] }, pagination)

    const madeLines = useMemo(() => {
        if (!made) return []
        const lines = [{ id: "Unidades", data: made.series.points.map((p) => ({ x: p.period, y: p.units })) }]
        if (made.series.previous_points.length) {
            lines.push({ id: "Período anterior", data: made.series.previous_points.map((p) => ({ x: p.period, y: p.units })) })
        }
        return lines
    }, [made])
    const inputLines = useMemo(() => {
        if (!input) return []
        const lines = [{ id: "Consumo", data: input.series.points.map((p) => ({ x: p.period, y: p.consumed })) }]
        if (input.series.previous_points.length) {
            lines.push({ id: "Período anterior", data: input.series.previous_points.map((p) => ({ x: p.period, y: p.consumed })) })
        }
        return lines
    }, [input])

    const section = (id: string, title: string, body: ReactNode, note?: string) => (
        <section key={id} aria-label={id} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {body}
        </section>
    )
    const chart = (lines: typeof madeLines, label: string) => (
        <div className="h-56 min-h-0">
            <LineChart
                data={lines}
                margin={CHART_MARGIN}
                colors={SERIES_COLORS}
                tooltipFormat="number"
                enableArea={false}
                pointSize={4}
                axisBottom={{ tickSize: 0, tickPadding: 8 }}
                axisLeft={{ tickSize: 0, tickPadding: 8 }}
                ariaLabel={label}
            />
        </div>
    )

    const renderSection = (name: (typeof composition.sections)[number]) => {
        switch (name) {
            case "made_chart":
                return <ChartSection key="made_chart" title="Unidades producidas por periodo">{chart(madeLines, "Unidades producidas por periodo, con el período anterior superpuesto")}</ChartSection>
            case "materials":
                return section("Insumos", "Consumo real contra planificado", (
                    <Collection.Root collection={materialsCollection}>
                        <Collection.View frame="card" table={madeMaterialsViews.table} emptyTitle="Sin insumos" emptyDescription="Las órdenes no registran consumos." />
                    </Collection.Root>
                ), "En cantidad de cada insumo; el costo se analiza en el tab Costos.")
            case "orders":
                return section("Órdenes terminadas", "Órdenes terminadas", (
                    <Collection.Root collection={ordersCollection}>
                        <Collection.View frame="card" table={madeOrdersViews.table} emptyTitle="Sin órdenes" emptyDescription="No hay órdenes terminadas en el periodo." />
                    </Collection.Root>
                ))
            case "input_chart":
                return <ChartSection key="input_chart" title="Consumo como insumo por periodo" label="Consumo por periodo">{chart(inputLines, "Consumo como insumo por periodo, con el período anterior superpuesto")}</ChartSection>
            case "by_product":
                return section("Por producto", "Consumo por producto fabricado", (
                    <Collection.Root collection={byProductCollection}>
                        <Collection.View frame="card" table={inputByProductViews.table} emptyTitle="Sin consumo" emptyDescription="No hubo consumo en el periodo." />
                    </Collection.Root>
                ))
            case "used_in":
                return section("Productos que lo usan", `Productos que lo usan: margen si sube ${input?.used_in.increase_pct ?? 0} %`, (
                    <Collection.Root collection={usedInCollection}>
                        <Collection.View frame="card" table={inputUsedInViews.table} emptyTitle="Sin productos" emptyDescription="Ninguna BOM activa usa este insumo." />
                    </Collection.Root>
                ))
        }
    }
    const madeSections = composition.sections.filter((s) => ["made_chart", "materials", "orders"].includes(s))
    const inputSections = composition.sections.filter((s) => ["input_chart", "by_product", "used_in"].includes(s))

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
            {made && (
                <>
                    <MetricStrip label="Fabricación del periodo">
                        <Metric label="Órdenes terminadas" value={made.kpis.orders} />
                        <Metric
                            label="Unidades producidas"
                            value={round2(made.kpis.units)}
                            delta={made.kpis.previous && made.kpis.previous.units > 0 ? { current: made.kpis.units, previous: made.kpis.previous.units } : undefined}
                        />
                        <Metric label="Rectificadas" value={made.kpis.rectified} context={`${made.kpis.rectification_rate.toFixed(1)} % de las órdenes`} />
                    </MetricStrip>
                    {madeSections.length === 0 && <p className="text-sm italic text-muted-foreground">Sin producción en el periodo</p>}
                    {madeSections.map(renderSection)}
                </>
            )}
            {input && (
                <>
                    <MetricStrip label="Uso como insumo">
                        <Metric
                            label="Consumo en OT"
                            value={round2(input.kpis.consumed)}
                            delta={input.kpis.previous && input.kpis.previous.consumed > 0 ? { current: input.kpis.consumed, previous: input.kpis.previous.consumed } : undefined}
                        />
                        <Metric label="OT con consumo" value={input.kpis.orders} />
                    </MetricStrip>
                    {inputSections.length === 0 && <p className="text-sm italic text-muted-foreground">Sin consumo en el periodo</p>}
                    {inputSections.map(renderSection)}
                </>
            )}
        </div>
    )
}

