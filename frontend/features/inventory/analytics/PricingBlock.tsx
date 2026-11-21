"use client"

import { useMemo } from "react"
import { BarChart, LineChart, Metric, MetricStrip } from "@/components/shared"
import type { MetricDelta } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composePricing } from "./composePricing"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import type { PricingParams, ProductPricing } from "./pricing.types"
import { SalesImpactBlock } from "./SalesImpactBlock"
import { useProductPricing } from "../hooks/useProductPricing"
import { pricingEffectsEntity, pricingEffectsViews, type PricingEffectRow } from "../entity-view/pricingEffects.entity"

const CHART_MARGIN = { top: 24, right: 16, bottom: 28, left: 64 }
const MARKER_STYLE = { stroke: "var(--color-muted-foreground)", strokeDasharray: "4 4" }
const percent = (value: number) => `${value.toFixed(1)}`

interface PricingBlockProps {
    productId: number
    period: PeriodKey
    capabilities: { has_variants: boolean }
}

/** "Precio y margen": realized margin, price vs sales charts, before/after of every price change, breakdown. */
export function PricingBlock({ productId, period, capabilities }: PricingBlockProps) {
    const params = useMemo<PricingParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period) }),
        [period],
    )
    const { data, isLoading, isError } = useProductPricing(productId, params)
    return (
        <AnalyticsBlockFrame
            isLoading={isLoading}
            isError={isError || !data}
            errorMessage="No se pudo cargar el análisis de precio y margen."
        >
            {data && <PricingBody data={data} productId={productId} period={period} capabilities={capabilities} />}
        </AnalyticsBlockFrame>
    )
}

function heroDelta(data: ProductPricing): MetricDelta | undefined {
    const previous = data.kpis.previous
    if (!previous) return undefined
    if (data.has_cost) {
        if (data.kpis.margin_pct === null || previous.margin_pct === null) return undefined
        const diff = data.kpis.margin_pct - previous.margin_pct
        return {
            text: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts`,
            direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
            tone: diff > 0 ? "success" : diff < 0 ? "destructive" : "neutral",
        }
    }
    return previous.avg_price > 0 ? { current: data.kpis.avg_price, previous: previous.avg_price } : undefined
}

function PricingBody({ data, productId, period, capabilities }: PricingBlockProps & { data: ProductPricing }) {
    const composition = composePricing(data, capabilities)
    const rows = useMemo<PricingEffectRow[]>(
        () => data.effects.map((e) => ({
            label: e.label,
            date: e.date,
            units_per_day_before: e.before.units_per_day,
            units_per_day_after: e.after.units_per_day,
            revenue_per_day_before: e.before.revenue_per_day,
            revenue_per_day_after: e.after.revenue_per_day,
            margin_per_unit_before: e.before.margin_per_unit,
            margin_per_unit_after: e.after.margin_per_unit,
            reliability: e.reliable ? "Confiable" : "Pocos datos",
        })),
        [data.effects],
    )
    const effectsCollection = useEntityCollection(pricingEffectsEntity, { rows }, { pagination: { mode: "none" } })

    const { kpis, today } = data
    const hero = composition.hero === "margin"
        ? <Metric label="Margen realizado" value={kpis.margin_pct === null ? null : percent(kpis.margin_pct)} unit="%" delta={heroDelta(data)} context="Neto de descuentos" />
        : <Metric label="Precio realizado" value={formatMoney(kpis.avg_price)} delta={heroDelta(data)} context="Precio medio neto vendido" />

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
                {hero}
                <Metric label="Ingreso neto" value={formatMoney(kpis.net_revenue)} />
                <Metric label="Unidades" value={kpis.units} />
                <Metric label="Descuento promedio" value={percent(kpis.avg_discount_pct)} unit="%" />
            </MetricStrip>
            <MetricStrip label="Hoy">
                <Metric label="Precio de lista c/IVA" value={formatMoney(today.list_price_gross)} />
                <Metric label="Precio de lista neto" value={formatMoney(today.list_price_net)} />
                {data.has_cost && <Metric label="Costo" value={formatMoney(today.cost)} />}
                {data.has_cost && (
                    <Metric label="Margen de lista" value={today.list_margin_pct === null ? null : percent(today.list_margin_pct)} unit="%" />
                )}
            </MetricStrip>
            {composition.sections.length === 0 && (
                <p className="text-sm italic text-muted-foreground">Sin ventas en el periodo</p>
            )}
            {composition.sections.map((section) => {
                if (section === "charts") return <PriceVsSales key={section} data={data} />
                if (section === "effects") {
                    return (
                        <section key={section} aria-label="Antes vs después" className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium">Antes vs después</h3>
                            <Collection.Root collection={effectsCollection}>
                                <Collection.View table={pricingEffectsViews.table} emptyTitle="Sin cambios" emptyDescription="No hubo cambios de precio ni reglas en el periodo." />
                            </Collection.Root>
                        </section>
                    )
                }
                return <SalesImpactBlock key={section} productId={productId} period={period} defaultGroupBy={composition.defaultGroupBy} />
            })}
            <p className="text-xs text-muted-foreground">
                La comparación entre precios y reglas es una asociación, no causalidad: no demuestra que el cambio provocó la venta.
            </p>
        </div>
    )
}

function PriceVsSales({ data }: { data: ProductPricing }) {
    const { points, by_rule: byRule } = data.series
    const periods = useMemo(() => new Set(points.map((p) => p.period)), [points])
    const lines = useMemo(() => {
        const rules = new Map<string, Array<{ x: string; y: number }>>()
        for (const entry of byRule) rules.set(entry.label, [...(rules.get(entry.label) ?? []), { x: entry.period, y: entry.avg_price }])
        return [
            { id: "Precio de lista", data: points.map((p) => ({ x: p.period, y: p.avg_list_price })) },
            { id: "Precio realizado", data: points.map((p) => ({ x: p.period, y: p.avg_price })) },
            ...[...rules].map(([id, series]) => ({ id, data: series })),
        ]
    }, [points, byRule])
    const markers = useMemo(
        () => data.effects
            .filter((e) => periods.has(e.period))
            .map((e) => ({
                axis: "x" as const,
                value: e.period,
                lineStyle: MARKER_STYLE,
                legend: e.kind === "rule" ? "Regla" : "Lista",
                legendPosition: "top" as const,
            })),
        [data.effects, periods],
    )
    const units = useMemo(() => points.map((p) => ({ period: p.period, Unidades: p.units })), [points])

    return (
        <section aria-label="Precio contra ventas" className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Precio contra ventas</h3>
            <div className="h-64 min-h-0">
                <LineChart
                    data={lines}
                    margin={CHART_MARGIN}
                    markers={markers}
                    tooltipFormat="currency"
                    enableArea={false}
                    pointSize={4}
                    axisBottom={{ tickSize: 0, tickPadding: 8 }}
                    axisLeft={{ tickSize: 0, tickPadding: 8 }}
                    ariaLabel="Precio de lista, precio realizado y precio por regla en el periodo"
                />
            </div>
            <div className="h-40 min-h-0">
                <BarChart
                    data={units}
                    keys={["Unidades"]}
                    indexBy="period"
                    margin={CHART_MARGIN}
                    tooltipFormat="number"
                    legends={[]}
                    ariaLabel="Unidades vendidas por periodo"
                />
            </div>
        </section>
    )
}
