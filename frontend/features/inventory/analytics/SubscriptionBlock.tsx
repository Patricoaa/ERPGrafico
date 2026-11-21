"use client"

import { useMemo, type ReactNode } from "react"
import { LineChart, Metric, MetricStrip } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { composeSubscription } from "./composeSubscription"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import type {
    ProductSubscriptionAnalysis, SubscriptionAnalysisParams, SubscriptionFrequency, SubscriptionStatus,
} from "./subscriptionAnalysis.types"
import { useProductSubscriptionAnalysis } from "../hooks/useProductSubscriptionAnalysis"
import {
    subscriptionPaymentsEntity, subscriptionPaymentsViews, subscriptionRowsEntity, subscriptionRowsViews,
    type SubscriptionTableRow,
} from "../entity-view/subscriptionAnalysis.entity"

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
    ACTIVE: "Activa", PAUSED: "Pausada", CANCELLED: "Cancelada", EXPIRED: "Vencida",
}
const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
    WEEKLY: "Semanal", MONTHLY: "Mensual", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual",
}
const CHART_MARGIN = { top: 24, right: 16, bottom: 28, left: 64 }
const SERIES_COLORS = ["var(--color-primary)", "var(--color-muted-foreground)"]

/** "Suscripción": recurring cost, payments against the previous period, price increases and due dates. */
export function SubscriptionBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const params = useMemo<SubscriptionAnalysisParams>(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period) }),
        [period],
    )
    const { data, isLoading, isError } = useProductSubscriptionAnalysis(productId, params)
    return (
        <AnalyticsBlockFrame
            isLoading={isLoading}
            isError={isError || !data}
            errorMessage="No se pudo cargar el análisis de la suscripción."
        >
            {data && <SubscriptionBody data={data} />}
        </AnalyticsBlockFrame>
    )
}

function SubscriptionBody({ data }: { data: ProductSubscriptionAnalysis }) {
    const composition = composeSubscription(data)
    const { today, kpis } = data
    const rows = useMemo<SubscriptionTableRow[]>(
        () => data.subscriptions.map((s) => ({
            supplier: s.supplier,
            status_label: STATUS_LABELS[s.status] ?? s.status,
            frequency_label: FREQUENCY_LABELS[s.frequency] ?? s.frequency,
            amount: s.amount,
            annualized: s.annualized,
            next_payment_date: s.next_payment_date,
            end_date: s.end_date,
            last_payment_amount: s.last_payment?.amount ?? null,
            change_pct: s.change_pct,
        })),
        [data.subscriptions],
    )
    const pagination = { pagination: { mode: "none" as const } }
    const rowsCollection = useEntityCollection(subscriptionRowsEntity, { rows }, pagination)
    const paymentsCollection = useEntityCollection(subscriptionPaymentsEntity, { rows: data.payments }, pagination)
    const lines = useMemo(() => {
        const current = [{ id: "Pagado", data: data.series.points.map((p) => ({ x: p.period, y: p.paid })) }]
        if (!data.series.previous_points.length) return current
        return [...current, { id: "Período anterior", data: data.series.previous_points.map((p) => ({ x: p.period, y: p.paid })) }]
    }, [data.series])

    const section = (id: string, title: string, body: ReactNode) => (
        <section key={id} aria-label={id} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
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
            <MetricStrip label="Costo recurrente">
                <Metric label="Costo anualizado" value={formatMoney(today.annualized_total)} />
                <Metric label="Equivalente mensual" value={formatMoney(today.monthly_equivalent)} />
                <Metric label="Activas" value={today.active_count} />
                <Metric label="Próximos 90 días" value={formatMoney(today.due_90d_total)} />
            </MetricStrip>
            <MetricStrip label="Pagos del periodo">
                <Metric
                    label="Pagado en el periodo"
                    value={formatMoney(kpis.paid)}
                    delta={kpis.previous && kpis.previous.paid > 0 ? { current: kpis.paid, previous: kpis.previous.paid, inverse: true } : undefined}
                />
                <Metric label="Pagos" value={kpis.payments} />
            </MetricStrip>
            {data.payments.length === 0 && <p className="text-sm italic text-muted-foreground">Sin pagos en el periodo</p>}
            {composition.sections.map((name) => {
                switch (name) {
                    case "chart":
                        return section("Evolución", "Pagado por periodo", (
                            <div className="h-56 min-h-0">
                                <LineChart
                                    data={lines}
                                    margin={CHART_MARGIN}
                                    colors={SERIES_COLORS}
                                    tooltipFormat="currency"
                                    enableArea={false}
                                    pointSize={4}
                                    axisBottom={{ tickSize: 0, tickPadding: 8 }}
                                    axisLeft={{ tickSize: 0, tickPadding: 8 }}
                                    ariaLabel="Pagado por periodo, con el período anterior superpuesto"
                                />
                            </div>
                        ))
                    case "subscriptions":
                        return section("Suscripciones", "Suscripciones", (
                            <Collection.Root collection={rowsCollection}>
                                <Collection.View table={subscriptionRowsViews.table} emptyTitle="Sin suscripciones" emptyDescription="El producto no tiene suscripciones." />
                            </Collection.Root>
                        ))
                    case "payments":
                        return section("Pagos", "Pagos del periodo", (
                            <Collection.Root collection={paymentsCollection}>
                                <Collection.View table={subscriptionPaymentsViews.table} emptyTitle="Sin pagos" emptyDescription="No hubo pagos en el periodo." />
                            </Collection.Root>
                        ))
                }
            })}
        </div>
    )
}
