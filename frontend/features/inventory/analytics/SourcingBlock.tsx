"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Metric, MetricStrip } from "@/components/shared"
import { Collection, formatNumber, useEntityCollection } from "@/components/entity-view"
import { formatMoney } from "@/lib/money"
import { AnalyticsBlockFrame } from "./AnalyticsBlockFrame"
import { periodToDateFrom, type PeriodKey } from "./period"
import { RailControls } from "./RailControls"
import { ViewControl } from "./ViewControl"
import { useProductSourcing } from "../hooks/useProductSourcing"
import { sourcingParentEntity, sourcingParentViews } from "../entity-view/sourcingParent.entity"
import type { MakeVsBuy, Sourcing } from "./sourcing.types"

const INCREASES = [{ value: 5, label: "5 %" }, { value: 10, label: "10 %" }, { value: 20, label: "20 %" }]
const formatIsoDate = (iso: string) => iso.split("-").reverse().join("-")

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
export type SourcingSection = "make_vs_buy" | "used_in"

export function SourcingBlock({
    productId, period, section,
}: { productId: number; period: PeriodKey; section?: SourcingSection }) {
    const [increasePct, setIncreasePct] = useState(10)
    const dateFrom = useMemo(() => periodToDateFrom(period), [period])
    const showMakeVsBuy = section === undefined || section === "make_vs_buy"
    const showUsedIn = section === undefined || section === "used_in"
    const { data, isLoading, isError } = useProductSourcing(productId, { date_from: dateFrom, increase_pct: increasePct })

    const parentsCollection = useEntityCollection(
        sourcingParentEntity, { rows: data?.used_in?.parents ?? [] }, { pagination: { mode: "none" } },
    )

    const parentsTable = (
        <Collection.Root collection={parentsCollection}>
            <Collection.View
                table={sourcingParentViews.table}
                emptyTitle="No se usa en BOM activas"
                emptyDescription="Ningún producto fabricable tiene este insumo en su BOM activa."
            />
        </Collection.Root>
    )

    return (
        <div className="flex flex-col gap-4">
            {showUsedIn && (
                <RailControls>
                    <ViewControl label="Subida de precio del insumo" value={increasePct} options={INCREASES} onChange={setIncreasePct} />
                </RailControls>
            )}
            <AnalyticsBlockFrame
                isLoading={isLoading}
                isError={isError || !data}
                errorMessage="No se pudo cargar el análisis de abastecimiento."
                isEmpty={!!data && !(showMakeVsBuy && data.make_vs_buy) && !(showUsedIn && data.used_in)}
                emptyMessage="Este producto no tiene datos de abastecimiento que analizar"
            >
                {data && <SourcingBody data={data} parentsTable={parentsTable} showMakeVsBuy={showMakeVsBuy} showUsedIn={showUsedIn} />}
            </AnalyticsBlockFrame>
        </div>
    )
}

function SourcingBody({
    data, parentsTable, showMakeVsBuy, showUsedIn,
}: { data: Sourcing; parentsTable: ReactNode; showMakeVsBuy: boolean; showUsedIn: boolean }) {
    return (
        <>
            {showMakeVsBuy && data.make_vs_buy && <MakeVsBuySection mvb={data.make_vs_buy} />}
            {showUsedIn && data.used_in && (
                <section className="flex flex-col gap-3" aria-label="Uso como insumo">
                    <h3 className="text-sm font-semibold">Uso como insumo: si su precio sube {formatNumber(data.used_in.increase_pct, 0)} %</h3>
                    {parentsTable}
                </section>
            )}
        </>
    )
}
