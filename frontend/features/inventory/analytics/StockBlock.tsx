"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChartSection, DualAxisChart, Metric, MetricStrip } from "@/components/shared"
import type { DualAxisSeries } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composeStock } from "./composeStock"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import { RailControls } from "./RailControls"
import type { IdleDays, ProductStockAnalysis, StockAnalysisParams } from "./stockAnalysis.types"
import { ViewControl } from "./ViewControl"
import { useProductStockAnalysis } from "../hooks/useProductStockAnalysis"
import {
    stockAdjustmentsEntity, stockAdjustmentsViews, stockFlowsEntity, stockFlowsViews, stockVariantsEntity,
    stockVariantsViews, stockWarehousesEntity, stockWarehousesViews, type StockWarehouseTableRow,
} from "../entity-view/stockAnalysis.entity"

const IDLE: Array<{ value: IdleDays; label: string }> = [
    { value: 30, label: "30 d" }, { value: 90, label: "90 d" }, { value: 180, label: "180 d" },
]
const formatIsoDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : null)
const round2 = (value: number) => Number(value.toFixed(2))

/** "Inventario": on hand, reserved, rotation, closing stock with in/out, flows, adjustments, warehouses, variants. */
export function StockBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const [idleDays, setIdleDays] = useState<IdleDays>(90)
    const params = useMemo<StockAnalysisParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period), idle_days: idleDays }),
        [period, idleDays],
    )
    const { data, isLoading, isError } = useProductStockAnalysis(productId, params)
    return (
        <div className="flex flex-col gap-4">
            <RailControls>
                <ViewControl label="Stock inmóvil desde" value={idleDays} options={IDLE} onChange={setIdleDays} />
            </RailControls>
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de inventario."
            >
                {data && <StockBody data={data} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

function StockBody({ data }: { data: ProductStockAnalysis }) {
    const composition = composeStock(data)
    const { today, rotation, coverage } = data
    const warehouseRows = useMemo<StockWarehouseTableRow[]>(
        () => data.warehouses.map((w) => ({
            name: w.name, on_hand: w.on_hand, last_move_date: w.last_move_date, status: w.idle ? "Inmóvil" : "",
        })),
        [data.warehouses],
    )
    const flowRows = useMemo(() => [...data.flows.inflows, ...data.flows.outflows], [data.flows])
    const pagination = { pagination: { mode: "none" as const } }
    const warehousesCollection = useEntityCollection(stockWarehousesEntity, { rows: warehouseRows }, pagination)
    const variantsCollection = useEntityCollection(stockVariantsEntity, { rows: data.variants }, pagination)
    const outflowsCollection = useEntityCollection(stockFlowsEntity, { rows: data.flows.outflows }, pagination)
    const inflowsCollection = useEntityCollection(stockFlowsEntity, { rows: data.flows.inflows }, pagination)
    const adjustmentsCollection = useEntityCollection(stockAdjustmentsEntity, { rows: data.adjustments }, pagination)

    const chart = useMemo(() => {
        const series: DualAxisSeries[] = [
            { id: "stock_end", label: "Stock al cierre", axis: "left", type: "line", data: data.series.map((p) => ({ x: p.period, y: p.stock_end })) },
            { id: "in_qty", label: "Entradas", axis: "right", type: "bar", data: data.series.map((p) => ({ x: p.period, y: p.in_qty })) },
            { id: "out_qty", label: "Salidas", axis: "right", type: "bar", data: data.series.map((p) => ({ x: p.period, y: p.out_qty })) },
        ]
        return { periods: data.series.map((p) => p.period), series }
    }, [data.series])

    const section = (id: string, title: string, body: ReactNode, note?: string) => (
        <section key={id} aria-label={id} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {body}
        </section>
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
            <MetricStrip label="Stock hoy">
                <Metric label="Existencia" value={round2(today.on_hand)} unit="un" />
                <Metric label="Valor" value={formatMoney(today.value)} context="Al costo ponderado" />
                <Metric label="Comprometido" value={round2(today.reserved)} unit="un" context="Ventas, POS y órdenes de trabajo" />
                <Metric label="Disponible" value={round2(today.available)} unit="un" tone={today.available < 0 ? "destructive" : "neutral"} />
            </MetricStrip>
            <MetricStrip label="Cobertura y rotación">
                <Metric
                    label="Cobertura"
                    value={coverage.coverage_days === null ? null : Math.round(coverage.coverage_days)}
                    unit="días"
                    context={coverage.daily_out > 0
                        ? `Consumo: ${round2(coverage.daily_out)} un/día (últimos 90 días)`
                        : "Sin salidas en los últimos 90 días"}
                />
                <Metric label="Días de inventario" value={rotation.days_of_inventory === null ? null : Math.round(rotation.days_of_inventory)} unit="días" context={`Stock promedio: ${round2(rotation.avg_stock)} un`} />
                <Metric label="Última salida" value={formatIsoDate(rotation.last_out_date)} />
            </MetricStrip>
            {!composition.sections.includes("chart") && (
                <p className="text-sm italic text-muted-foreground">Sin movimientos en el periodo</p>
            )}
            {composition.sections.map((name) => {
                switch (name) {
                    case "chart":
                        return (
                            <ChartSection key="Evolución" title="Stock al cierre, entradas y salidas" label="Evolución">
                                <DualAxisChart
                                    series={chart.series}
                                    periods={chart.periods}
                                    leftAxisFormat="number"
                                    rightAxisFormat="number"
                                    leftAxisLabel="Stock (un)"
                                    rightAxisLabel="Entradas y salidas (un)"
                                    mode="bar-line"
                                    ariaLabel="Stock al cierre en el eje izquierdo; entradas y salidas por periodo en el eje derecho"
                                />
                            </ChartSection>
                        )
                    case "flows":
                        return section("Flujos", "Entradas por origen y salidas por destino", (
                            <div className="grid gap-4 @[40rem]:grid-cols-2">
                                <Collection.Root collection={inflowsCollection}>
                                    <Collection.View frame="card" table={stockFlowsViews.table} emptyTitle="Sin entradas" emptyDescription="No hubo entradas en el periodo." />
                                </Collection.Root>
                                <Collection.Root collection={outflowsCollection}>
                                    <Collection.View frame="card" table={stockFlowsViews.table} emptyTitle="Sin salidas" emptyDescription="No hubo salidas en el periodo." />
                                </Collection.Root>
                            </div>
                        ), flowRows.length > 0 ? "Las transferencias entre bodegas no cuentan como entrada ni salida." : undefined)
                    case "adjustments":
                        return section("Ajustes", "Ajustes de inventario", (
                            <Collection.Root collection={adjustmentsCollection}>
                                <Collection.View frame="card" table={stockAdjustmentsViews.table} emptyTitle="Sin ajustes" emptyDescription="No hubo ajustes en el periodo." />
                            </Collection.Root>
                        ))
                    case "warehouses":
                        return section("Bodegas", "Stock por bodega", (
                            <Collection.Root collection={warehousesCollection}>
                                <Collection.View frame="card" table={stockWarehousesViews.table} emptyTitle="Sin bodegas" emptyDescription="El producto no tiene stock en bodegas." />
                            </Collection.Root>
                        ))
                    case "variants":
                        return section("Variantes", "Stock por variante", (
                            <Collection.Root collection={variantsCollection}>
                                <Collection.View frame="card" table={stockVariantsViews.table} emptyTitle="Sin variantes" emptyDescription="El producto no tiene variantes." />
                            </Collection.Root>
                        ))
                }
            })}
        </div>
    )
}
