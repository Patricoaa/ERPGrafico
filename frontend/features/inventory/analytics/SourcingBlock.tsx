"use client"

import { useMemo, useState } from "react"
import { Metric, MetricStrip } from "@/components/shared"
import { Collection, formatNumber, useEntityCollection } from "@/components/entity-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMoney } from "@/lib/money"
import { monthsAgoIso } from "./monthsAgoIso"
import { useProductSourcing } from "../hooks/useProductSourcing"
import { sourcingParentEntity, sourcingParentViews } from "../entity-view/sourcingParent.entity"
import type { MakeVsBuy } from "./sourcing.types"

const RANGES = [{ value: 3, label: "3 m" }, { value: 12, label: "12 m" }, { value: 24, label: "24 m" }]
const INCREASES = [{ value: 5, label: "5 %" }, { value: 10, label: "10 %" }, { value: 20, label: "20 %" }]
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")

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

function MakeVsBuySection({ mvb }: { mvb: MakeVsBuy }) {
    const { make, buy } = mvb
    const noMake = make.orders === 0 || make.unit_cost <= 0
    const noBuy = buy.receipts === 0
    return (
        <section className="flex flex-col gap-3" aria-label="Fabricar vs comprar">
            <MetricStrip label="Costo unitario de fabricar y de comprar">
                <Metric label="Fabricar" value={noMake ? "—" : formatMoney(make.unit_cost)} context={noMake ? undefined : `${make.orders} OT · ${formatNumber(make.units_made, 0)} un · BOM ${formatMoney(make.bom_cost)}`} />
                <Metric label="Comprar" value={noBuy ? "—" : formatMoney(buy.avg_unit_cost)} context={noBuy ? undefined : `${buy.receipts} recepciones · último ${formatMoney(buy.last_unit_cost)}${buy.last_date ? ` (${formatIsoDate(buy.last_date)})` : ""}`} />
            </MetricStrip>
            {noMake && <p className="text-xs text-muted-foreground">Sin OT con costo en el periodo</p>}
            {noBuy && <p className="text-xs text-muted-foreground">Sin compras recibidas en el periodo</p>}
            {mvb.saving_per_unit !== null && mvb.saving_total !== null && mvb.cheaper && (
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {mvb.cheaper === "MAKE" ? "Fabricar es más barato" : "Comprar es más barato"}:
                    {" "}{formatMoney(Math.abs(mvb.saving_per_unit))} por unidad
                    {" "}({formatMoney(Math.abs(mvb.saving_total))} sobre lo fabricado en el periodo).
                </p>
            )}
        </section>
    )
}

/** "Abastecimiento": make-vs-buy comparison and input-usage price sensitivity (ADR-0147). */
export function SourcingBlock({ productId }: { productId: number }) {
    const [rangeMonths, setRangeMonths] = useState(12)
    const [increasePct, setIncreasePct] = useState(10)
    const dateFrom = useMemo(() => monthsAgoIso(rangeMonths), [rangeMonths])
    const { data, isLoading, isError } = useProductSourcing(productId, { date_from: dateFrom, increase_pct: increasePct })

    const parentsCollection = useEntityCollection(
        sourcingParentEntity, { rows: data?.used_in?.parents ?? [] }, { pagination: { mode: "none" } },
    )

    let body: React.ReactNode
    if (isLoading) {
        body = <p role="status" className="text-sm text-muted-foreground">Cargando análisis de abastecimiento…</p>
    } else if (isError || !data) {
        body = <p role="alert" className="text-sm text-destructive">No se pudo cargar el análisis de abastecimiento.</p>
    } else if (!data.make_vs_buy && !data.used_in) {
        body = <p className="text-sm text-muted-foreground italic">Este producto no tiene datos de abastecimiento que analizar</p>
    } else {
        body = (
            <>
                {data.make_vs_buy && <MakeVsBuySection mvb={data.make_vs_buy} />}
                {data.used_in && (
                    <section className="flex flex-col gap-3" aria-label="Uso como insumo">
                        <h3 className="text-sm font-semibold">Uso como insumo: si su precio sube {formatNumber(data.used_in.increase_pct, 0)} %</h3>
                        <Collection.Root collection={parentsCollection}>
                            <Collection.View
                                table={sourcingParentViews.table}
                                emptyTitle="No se usa en BOM activas"
                                emptyDescription="Ningún producto fabricable tiene este insumo en su BOM activa."
                            />
                        </Collection.Root>
                    </section>
                )}
            </>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <Control label="Rango (compras y OT)" value={rangeMonths} options={RANGES} onChange={setRangeMonths} />
                <Control label="Subida de precio del insumo" value={increasePct} options={INCREASES} onChange={setIncreasePct} />
            </div>
            {body}
        </div>
    )
}
