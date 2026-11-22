"use client"

import { useMemo, type ReactNode } from "react"
import { ChartSection, LineChart, Metric, MetricStrip, type MetricDelta } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { LdmComposition } from "./LdmComposition"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composeCosts, type CostsComposition } from "./composeCosts"
import type { CostsMode, CostsParams, CostsPoint, ProductCosts } from "./costs.types"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import { useProductCosts } from "../hooks/useProductCosts"
import {
    costsPurchasesEntity, costsPurchasesViews, costsWorkOrdersEntity, costsWorkOrdersViews,
} from "../entity-view/costs.entity"

const CHART_MARGIN = { top: 24, right: 16, bottom: 28, left: 64 }
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")
const money = (value: number | null) => (value === null ? null : formatMoney(value))

type SeriesKey = "weighted_cost" | "bom_cost" | "purchase_avg" | "real_avg"
const SERIES_LABELS: Record<SeriesKey, string> = {
    weighted_cost: "Costo ponderado",
    bom_cost: "LdM teórica",
    purchase_avg: "Compras",
    real_avg: "Real por orden",
}
const SERIES_BY_MODE: Record<CostsMode, SeriesKey[]> = {
    purchased: ["weighted_cost"],
    stock_only: ["weighted_cost"],
    manufactured_stock: ["weighted_cost"],
    manufactured_on_demand: ["bom_cost"],
    manufactured_no_bom: ["real_avg"],
}

/** "Costos": cost by cost mode — weighted, purchases, theoretical BOM and real cost per work order. */
export function CostsBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const params = useMemo<CostsParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period) }),
        [period],
    )
    const { data, isLoading, isError } = useProductCosts(productId, params)
    return (
        <AnalyticsBlockFrame
            isLoading={isLoading}
            isError={isError || !data}
            errorMessage="No se pudo cargar el análisis de costos."
        >
            {data && <CostsBody data={data} />}
        </AnalyticsBlockFrame>
    )
}

function changeDelta(pct: number | null): MetricDelta | undefined {
    if (pct === null) return undefined
    return {
        text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)} %`,
        direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
        // A rising cost is bad news.
        tone: pct > 0 ? "destructive" : pct < 0 ? "success" : "neutral",
    }
}

function chartLines(series: CostsPoint[], mode: CostsMode) {
    return SERIES_BY_MODE[mode]
        .map((key) => ({
            id: SERIES_LABELS[key],
            data: series.flatMap((p) => (p[key] === null ? [] : [{ x: p.period, y: p[key] as number }])),
        }))
        .filter((line) => line.data.length > 0)
}

function Secondary({ figure, data }: { figure: CostsComposition["secondary"][number]; data: ProductCosts }) {
    const { today } = data
    if (figure === "bom_today") return <Metric label="Costo de LdM hoy" value={money(today.bom_cost)} />
    if (figure === "last_purchase" && today.last_purchase) {
        const last = today.last_purchase
        return (
            <Metric
                label="Última compra"
                value={formatMoney(last.unit_cost)}
                context={`${formatIsoDate(last.date)}${last.supplier ? ` · ${last.supplier}` : ""}`}
            />
        )
    }
    return null
}

function CostsBody({ data }: { data: ProductCosts }) {
    const composition = composeCosts(data)
    const purchasesCollection = useEntityCollection(costsPurchasesEntity, { rows: data.purchases.items }, { pagination: { mode: "none" } })
    const ordersCollection = useEntityCollection(costsWorkOrdersEntity, { rows: data.work_orders }, { pagination: { mode: "none" } })
    const lines = useMemo(() => chartLines(data.series, data.mode), [data.series, data.mode])

    const hasLdm = composition.sections.includes("bom")
    const hasOrders = composition.sections.includes("work_orders")
    const section = (id: string, title: string, body: ReactNode, note?: string) => (
        <section key={id} aria-label={id} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {body}
        </section>
    )

    return (
        <div className="@container flex flex-col gap-4">
            {composition.findings.length > 0 && (
                <ul aria-label="Hallazgos" className="flex flex-col gap-2">
                    {composition.findings.map((finding) => (
                        <li key={finding.id} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                            {finding.message}
                        </li>
                    ))}
                </ul>
            )}
            <MetricStrip label="Costo hoy">
                <Metric label={composition.hero.label} value={money(composition.hero.value)} delta={changeDelta(data.kpis.cost_change_pct)} />
                {composition.secondary.map((figure) => <Secondary key={figure} figure={figure} data={data} />)}
            </MetricStrip>
            {composition.sections.length === 0 && (
                <p className="text-sm italic text-muted-foreground">Sin movimientos de costo en el periodo</p>
            )}
            {composition.sections.map((name) => {
                switch (name) {
                    case "chart":
                        return (
                            <ChartSection key={name} title="Evolución del costo" label="Evolución del costo">
                                <div className="h-64 min-h-0">
                                    <LineChart
                                        data={lines}
                                        margin={CHART_MARGIN}
                                        tooltipFormat="currency"
                                        enableArea={false}
                                        pointSize={4}
                                        axisBottom={{ tickSize: 0, tickPadding: 8 }}
                                        axisLeft={{ tickSize: 0, tickPadding: 8 }}
                                        ariaLabel="Evolución del costo unitario en el periodo"
                                    />
                                </div>
                            </ChartSection>
                        )
                    case "purchases":
                        return section("Compras del periodo", "Compras del periodo", (
                            <Collection.Root collection={purchasesCollection}>
                                <Collection.View frame="card" table={costsPurchasesViews.table} emptyTitle="Sin compras" emptyDescription="No hubo recepciones en el periodo." />
                            </Collection.Root>
                        ))
                }
            })}
            {(hasLdm || hasOrders) && (
                <div className="grid items-start gap-4 @[34rem]:grid-cols-2">
                    {hasLdm && <LdmComposition lines={data.bom?.lines ?? []} />}
                    {hasOrders && section("Órdenes de trabajo", "Costo real por orden", (
                        <Collection.Root collection={ordersCollection}>
                            <Collection.View frame="card" table={costsWorkOrdersViews.table} emptyTitle="Sin órdenes" emptyDescription="No hay órdenes terminadas en el periodo." />
                        </Collection.Root>
                    ))}
                </div>
            )}
        </div>
    )
}
