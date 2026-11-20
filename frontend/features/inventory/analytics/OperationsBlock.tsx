"use client"

import { useMemo, useState } from "react"
import { AnalyticsChart, StatCard } from "@/components/shared"
import { Collection, formatDate, formatNumber, useEntityCollection } from "@/components/entity-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMoney } from "@/lib/money"
import { monthsAgoIso } from "./monthsAgoIso"
import { useProductOperations } from "../hooks/useProductOperations"
import { operationsSubscriptionEntity, operationsSubscriptionViews } from "../entity-view/operationsSubscription.entity"
import { operationsPaymentEntity, operationsPaymentViews } from "../entity-view/operationsPayment.entity"
import type { Rotation, SubscriptionsSummary } from "./operations.types"

const RANGES = [{ value: 3, label: "3 m" }, { value: 12, label: "12 m" }, { value: 24, label: "24 m" }]
const IDLE = [{ value: 30, label: "30 d" }, { value: 90, label: "90 d" }, { value: 180, label: "180 d" }]
const DASH = "—"

function Control({
    label, value, options, onChange,
}: { label: string; value: number; options: Array<{ value: number; label: string }>; onChange: (v: number) => void }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <ToggleGroup
                type="single" value={String(value)} aria-label={label} className="justify-start gap-1"
                onValueChange={(v) => v && onChange(Number(v))}
            >
                {options.map((o) => (
                    <ToggleGroupItem
                        key={o.value} value={String(o.value)} size="sm"
                        className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        {o.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    )
}

const orDash = (value: number | null, decimals: number, suffix = "") =>
    value === null ? DASH : `${formatNumber(value, decimals)}${suffix}`

function RotationSection({ rotation }: { rotation: Rotation }) {
    const rows = useMemo(
        () => rotation.series.map((p) => ({ period: p.month, Salidas: p.out, "Stock al cierre": p.stock_end })),
        [rotation.series],
    )
    return (
        <section className="flex flex-col gap-3" aria-label="Rotación de stock">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Rotación" valueSize="xl" accent="primary" value={orDash(rotation.turnover, 2, " ×")} subtext={`${formatNumber(rotation.out_qty, 0)} un salidas`} />
                <StatCard label="Días de inventario" valueSize="xl" accent="info" value={orDash(rotation.days_of_inventory, 0)} />
                <StatCard
                    label="Cobertura" valueSize="xl" accent={rotation.idle ? "warning" : "success"}
                    value={rotation.coverage_days === null ? DASH : `${formatNumber(rotation.coverage_days, 0)} días`}
                    subtext="al ritmo de los últimos 90 días"
                />
                <StatCard label="Valor del stock" valueSize="xl" accent="muted" value={formatMoney(rotation.stock_value)} subtext={`${formatNumber(rotation.stock_now, 0)} un`} />
            </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Costo anualizado" valueSize="xl" accent="primary" value={formatMoney(subs.annualized_total)} subtext={`${formatMoney(subs.monthly_equivalent_total)} / mes · ${subs.count} activas`} />
                <StatCard label="Próximos 90 días" valueSize="xl" accent="warning" value={formatMoney(subs.due_90d_total)} />
                <StatCard
                    label="Variación primer a último pago" valueSize="xl" accent="info"
                    value={subs.first_to_last_pct === null ? DASH : `${formatNumber(subs.first_to_last_pct, 1)} %`}
                />
            </div>
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
export function OperationsBlock({ productId }: { productId: number }) {
    const [rangeMonths, setRangeMonths] = useState(12)
    const [idleDays, setIdleDays] = useState(90)
    const dateFrom = useMemo(() => monthsAgoIso(rangeMonths), [rangeMonths])
    const { data, isLoading, isError } = useProductOperations(productId, { date_from: dateFrom, idle_days: idleDays })

    let body: React.ReactNode
    if (isLoading) {
        body = <p role="status" className="text-sm text-muted-foreground">Cargando análisis de operación…</p>
    } else if (isError || !data) {
        body = <p role="alert" className="text-sm text-destructive">No se pudo cargar el análisis de operación.</p>
    } else if (!data.rotation && !data.subscriptions) {
        body = <p className="text-sm text-muted-foreground italic">Este producto no tiene datos de operación que analizar</p>
    } else {
        body = (
            <>
                {data.rotation && <RotationSection rotation={data.rotation} />}
                {data.subscriptions && <SubscriptionsSection subs={data.subscriptions} />}
            </>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <Control label="Rango" value={rangeMonths} options={RANGES} onChange={setRangeMonths} />
                <Control label="Stock inmóvil desde" value={idleDays} options={IDLE} onChange={setIdleDays} />
            </div>
            {body}
        </div>
    )
}
