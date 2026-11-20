"use client"

import { useMemo, useState } from "react"
import { AnalyticsChart, Metric, MetricStrip } from "@/components/shared"
import { Collection, formatDate, formatNumber, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { periodToDateFrom, type PeriodKey } from "./period"
import { RailControls } from "./RailControls"
import { ViewControl } from "./ViewControl"
import { useProductOperations } from "../hooks/useProductOperations"
import { operationsSubscriptionEntity, operationsSubscriptionViews } from "../entity-view/operationsSubscription.entity"
import { operationsPaymentEntity, operationsPaymentViews } from "../entity-view/operationsPayment.entity"
import type { Operations, Rotation, SubscriptionsSummary } from "./operations.types"

const IDLE = [{ value: 30, label: "30 d" }, { value: 90, label: "90 d" }, { value: 180, label: "180 d" }]
const DASH = "—"

const orDash = (value: number | null, decimals: number, suffix = "") =>
    value === null ? DASH : `${formatNumber(value, decimals)}${suffix}`

function RotationSection({ rotation }: { rotation: Rotation }) {
    const rows = useMemo(
        () => rotation.series.map((p) => ({ period: p.month, Salidas: p.out, "Stock al cierre": p.stock_end })),
        [rotation.series],
    )
    return (
        <section className="flex flex-col gap-3" aria-label="Rotación de stock">
            <MetricStrip label="Rotación y cobertura del inventario">
                <Metric label="Rotación" value={orDash(rotation.turnover, 2, " ×")} context={`${formatNumber(rotation.out_qty, 0)} un salidas`} />
                <Metric label="Días de inventario" value={orDash(rotation.days_of_inventory, 0)} />
                <Metric label="Cobertura" value={rotation.coverage_days === null ? DASH : `${formatNumber(rotation.coverage_days, 0)} días`} context="al ritmo de los últimos 90 días" tone={rotation.idle ? "warning" : "success"} />
                <Metric label="Valor del stock" value={formatMoney(rotation.stock_value)} context={`${formatNumber(rotation.stock_now, 0)} un`} />
            </MetricStrip>
            {rotation.idle && (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                    Stock inmóvil: hay {formatNumber(rotation.stock_now, 0)} un y
                    {rotation.last_out_date ? ` la última salida fue el ${formatDate(rotation.last_out_date)}` : " nunca salió"}
                    {" "}(umbral {rotation.idle_days} días).
                </p>
            )}
            {rows.length > 0 && (
                <div className="h-64 min-h-0">
                    <AnalyticsChart type="bar-chart" preset="card" data={rows} keys={["Salidas", "Stock al cierre"]} indexBy="period" showLegend />
                </div>
            )}
        </section>
    )
}

function SubscriptionsSection({ subs }: { subs: SubscriptionsSummary }) {
    const items = useEntityCollection(operationsSubscriptionEntity, { rows: subs.items }, { pagination: { mode: "none" } })
    const payments = useEntityCollection(operationsPaymentEntity, { rows: subs.payments }, { pagination: { mode: "none" } })
    return (
        <section className="flex flex-col gap-3" aria-label="Suscripciones">
            <MetricStrip label="Suscripciones del producto">
                <Metric label="Costo anualizado" value={formatMoney(subs.annualized_total)} context={`${formatMoney(subs.monthly_equivalent_total)} / mes · ${subs.count} activas`} />
                <Metric label="Próximos 90 días" value={formatMoney(subs.due_90d_total)} />
                <Metric label="Variación primer a último pago" value={subs.first_to_last_pct === null ? DASH : `${formatNumber(subs.first_to_last_pct, 1)} %`} />
            </MetricStrip>
            <Collection.Root collection={items}>
                <Collection.View table={operationsSubscriptionViews.table} emptyTitle="Sin suscripciones" emptyDescription="Este producto no tiene suscripciones registradas." />
            </Collection.Root>
            {subs.payments.length > 0 && (
                <Collection.Root collection={payments}>
                    <Collection.View table={operationsPaymentViews.table} emptyTitle="Sin pagos" emptyDescription="No hay pagos registrados." />
                </Collection.Root>
            )}
        </section>
    )
}

/** "Operación": stock rotation/coverage and subscription costs (ADR-0148). */
export function OperationsBlock({ productId, period }: { productId: number; period: PeriodKey }) {
    const [idleDays, setIdleDays] = useState(90)
    const dateFrom = useMemo(() => periodToDateFrom(period), [period])
    const { data, isLoading, isError } = useProductOperations(productId, { date_from: dateFrom, idle_days: idleDays })

    return (
        <div className="flex flex-col gap-4">
            <RailControls>
                <ViewControl label="Stock inmóvil desde" value={idleDays} options={IDLE} onChange={setIdleDays} />
            </RailControls>
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de operación."
                isEmpty={!!data && !data.rotation && !data.subscriptions}
                emptyMessage="Este producto no tiene datos de operación que analizar"
            >
                {data && <OperationsBody data={data} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

function OperationsBody({ data }: { data: Operations }) {
    return (
        <>
            {data.rotation && <RotationSection rotation={data.rotation} />}
            {data.subscriptions && <SubscriptionsSection subs={data.subscriptions} />}
        </>
    )
}
