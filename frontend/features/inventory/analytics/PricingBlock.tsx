"use client"

import { useMemo } from "react"
import { ChartSection, DualAxisChart, Metric, MetricStrip } from "@/components/shared"
import type { DualAxisSeries } from "@/components/shared"
import { formatMoney } from "@/lib/money"
import { grossFromNet } from "@/lib/vat"
import { useVatRate } from "@/hooks/useVatRate"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composePricing } from "./composePricing"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import type { PricingParams, ProductPricing } from "./pricing.types"
import { useProductPricing } from "../hooks/useProductPricing"

const percent = (value: number) => `${value.toFixed(1)}`

interface PricingBlockProps {
    productId: number
    period: PeriodKey
    capabilities: { has_variants: boolean }
}

/** "Precios y reglas": evolución de precios base con IVA en el tiempo, reglas activas y su impacto en ventas. */
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
            errorMessage="No se pudo cargar el análisis de precios."
        >
            {data && <PricingBody data={data} productId={productId} period={period} capabilities={capabilities} />}
        </AnalyticsBlockFrame>
    )
}

function PricingBody({ data, capabilities }: PricingBlockProps & { data: ProductPricing }) {
    const composition = composePricing(data, capabilities)
    const { today, series, rule_windows: rules } = data
    // ADR-0151: net → gross only through lib/vat.ts with the configured VAT rate.
    const { multiplier: vatMultiplier } = useVatRate()
    const totalUnits = data.kpis.units

    // Calcular unidades vendidas con el precio de lista vs reglas
    const { listUnits, ruleUnitsMap } = useMemo(() => {
        let lUnits = 0
        const rMap = new Map<string, number>()

        if (series.by_rule.length === 0) {
            lUnits = totalUnits
        } else {
            for (const r of series.by_rule) {
                if (r.key === "list") {
                    lUnits += r.units
                } else {
                    const current = rMap.get(r.key) ?? 0
                    rMap.set(r.key, current + r.units)
                }
            }
        }
        return { listUnits: lUnits, ruleUnitsMap: rMap }
    }, [series.by_rule, totalUnits])

    // Series para el gráfico compuesto de doble eje (Precios siempre con IVA en Y1, Ventas en Y2)
    const chartData = useMemo(() => {
        const periods = series.points.map((p) => p.period)
        if (periods.length === 0) return { periods: [], chartSeries: [] }

        const chartSeries: DualAxisSeries[] = []

        // 1. Eje Izquierdo (Y1): Precio de lista con IVA
        chartSeries.push({
            id: "price_list",
            label: "Precio de lista",
            axis: "left",
            type: "line",
            data: series.points.map((p) => ({
                x: p.period,
                y: Math.round(p.avg_list_price_gross || (p.avg_list_price ? grossFromNet(p.avg_list_price, vatMultiplier) : today.list_price_gross)),
            })),
        })

        // 2. Eje Izquierdo (Y1): Reglas de precio con IVA
        for (const rule of rules) {
            const rulePoints = series.points.map((p) => {
                const entry = series.by_rule.find((r) => r.period === p.period && r.key === String(rule.rule_id))
                let grossPrice = entry?.avg_price_gross
                if (grossPrice == null || grossPrice === 0) {
                    if (entry?.avg_price) {
                        grossPrice = grossFromNet(entry.avg_price, vatMultiplier)
                    } else if (rule.fixed_price_gross && rule.fixed_price_gross > 0) {
                        grossPrice = rule.fixed_price_gross
                    } else if (rule.fixed_price > 0) {
                        grossPrice = grossFromNet(rule.fixed_price, vatMultiplier)
                    } else if (rule.discount_percentage > 0) {
                        const base = p.avg_list_price_gross || (p.avg_list_price ? grossFromNet(p.avg_list_price, vatMultiplier) : today.list_price_gross)
                        grossPrice = base * (1 - rule.discount_percentage / 100)
                    } else {
                        grossPrice = today.list_price_gross
                    }
                }
                return { x: p.period, y: Math.round(grossPrice) }
            })

            chartSeries.push({
                id: `price_rule_${rule.rule_id}`,
                label: rule.name,
                axis: "left",
                type: "line",
                data: rulePoints,
            })
        }

        // 3. Eje Derecho (Y2): Ventas Precio de lista
        chartSeries.push({
            id: "sales_list",
            label: "Ventas Lista",
            axis: "right",
            type: "bar",
            data: series.points.map((p) => {
                const entry = series.by_rule.find((r) => r.period === p.period && r.key === "list")
                const val = entry?.net_revenue ?? (series.by_rule.length === 0 ? p.net_revenue : 0)
                return { x: p.period, y: Math.round(val) }
            }),
        })

        // 4. Eje Derecho (Y2): Ventas por cada regla
        for (const rule of rules) {
            chartSeries.push({
                id: `sales_rule_${rule.rule_id}`,
                label: `Ventas ${rule.name}`,
                axis: "right",
                type: "bar",
                data: series.points.map((p) => {
                    const entry = series.by_rule.find((r) => r.period === p.period && r.key === String(rule.rule_id))
                    return { x: p.period, y: Math.round(entry?.net_revenue ?? 0) }
                }),
            })
        }

        return { periods, chartSeries }
    }, [series.points, series.by_rule, rules, today.list_price_gross, vatMultiplier])

    return (
        <div className="flex flex-col gap-5">
            {composition.findings.length > 0 && (
                <ul aria-label="Hallazgos" className="flex flex-col gap-2">
                    {composition.findings.map((finding) => (
                        <li key={finding.id} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                            {finding.message}
                        </li>
                    ))}
                </ul>
            )}

            {/* Fila de KPIs: Precio Actual c/IVA + N Reglas con Barra de Progreso de ventas */}
            <MetricStrip label="Precios vigentes y asignación en ventas">
                <Metric
                    label="Precio actual (c/IVA)"
                    value={formatMoney(today.list_price_gross)}
                    info="Precio de lista vigente con IVA incluido. La barra indica el volumen de ventas en que se usó este precio."
                    visual={
                        totalUnits > 0
                            ? {
                                kind: "progress",
                                current: Math.round(listUnits),
                                max: Math.round(totalUnits),
                                noun: "unidades vendidas",
                            }
                            : undefined
                    }
                    context={today.list_price_net ? `Neto: ${formatMoney(today.list_price_net)}` : undefined}
                />

                {rules.map((rule) => {
                    const grossPrice =
                        rule.rule_type === "DISCOUNT_PERCENTAGE"
                            ? Math.round(today.list_price_gross * (1 - rule.discount_percentage / 100))
                            : (rule.fixed_price_gross || grossFromNet(rule.fixed_price, vatMultiplier))
                    const ruleValText = formatMoney(grossPrice)
                    const used = ruleUnitsMap.get(String(rule.rule_id)) ?? 0

                    return (
                        <Metric
                            key={rule.rule_id}
                            label={rule.name}
                            value={ruleValText}
                            info={`Condición: ${rule.condition}. La barra indica en cuántas ventas del período se aplicó.`}
                            visual={
                                totalUnits > 0
                                    ? {
                                        kind: "progress",
                                        current: Math.round(used),
                                        max: Math.round(totalUnits),
                                        noun: "unidades vendidas",
                                    }
                                    : undefined
                            }
                            context={
                                rule.rule_type === "DISCOUNT_PERCENTAGE"
                                    ? `${percent(rule.discount_percentage)}% dto · ${rule.condition}`
                                    : `Fijo c/IVA · ${rule.condition}`
                            }
                        />
                    )
                })}
            </MetricStrip>

            {/* Gráfico compuesto de doble eje Y */}
            {chartData.periods.length > 0 ? (
                <ChartSection title="Evolución de precios y ventas asociadas" label="Evolución de precios y ventas">
                    <DualAxisChart
                        series={chartData.chartSeries}
                        periods={chartData.periods}
                        leftAxisFormat="currency"
                        rightAxisFormat="currency"
                        leftAxisLabel="Precios c/IVA ($)"
                        rightAxisLabel="Ventas ($)"
                        mode="bar-line"
                        ariaLabel="Evolución de precios con IVA en eje izquierdo y ventas en eje derecho"
                    />
                </ChartSection>
            ) : (
                <p className="text-sm italic text-muted-foreground">Sin ventas en el periodo</p>
            )}

            <p className="text-xs text-muted-foreground">
                La comparación entre precios y reglas es una asociación, no causalidad: no demuestra que el cambio provocó la venta.
            </p>
        </div>
    )
}
