"use client"

import { useMemo } from "react"
import { Layers, History, ArrowRightLeft } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { FormSection, StatCard } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { Partner } from "@/features/contacts"
import { usePartnerStakes, usePartnerStatement } from "../hooks"
import { partnerStakeEntity, partnerStakeViews } from "../entity-view/partnerStake.entity"
import { isCapitalMovement } from "../entity-view/partnerMovement.entity"
import { partnerActionsFor } from "./partnerActions"
import type { PartnerActionRunner } from "./partnerActionRequest"
import { PartnerPanelActions } from "./PartnerPanelActions"
import { PartnerMovementsTable } from "./PartnerMovementsTable"
import { movementsOf } from "./movementRows"

const money = (v: string | number | null | undefined) => formatCurrency(Number(v) || 0)

function StakesTable({ partnerId }: { partnerId: number }) {
    const { data: stakes = [], isLoading, isError, refetch } = usePartnerStakes(partnerId)
    const collection = useEntityCollection(
        partnerStakeEntity,
        { rows: stakes, isLoading, error: isError, refetch },
        { pagination: { mode: "none" } },
    )
    return (
        <Collection.Root collection={collection}>
            <Collection.View table={partnerStakeViews.table} emptyTitle="Sin historial" emptyDescription="Aún no hay vigencias de participación registradas." />
        </Collection.Root>
    )
}

/** Avance del enteramiento: lo enterado sobre lo suscrito (tope visual 100%; el exceso se informa en las tarjetas). */
function PaidInProgress({ subscribed, paidIn }: { subscribed: number; paidIn: number }) {
    if (subscribed <= 0) return null
    const pct = Math.min(100, Math.round((paidIn / subscribed) * 100))
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Capital enterado sobre suscrito</span>
                <span className="font-medium tabular-nums text-foreground">{pct}%</span>
            </div>
            <div role="progressbar" aria-label="Capital enterado sobre suscrito" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

/** Pestaña Capital de la ficha: composición del capital, vigencias de participación, movimientos y acciones. */
export function PartnerCapitalPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    const statement = usePartnerStatement(partner.id)
    const rows = useMemo(() => movementsOf(statement.data, isCapitalMovement), [statement.data])
    const actions = partnerActionsFor(partner, "capital", { run })
    const excess = Number(partner.partner_excess_capital) > 0

    return (
        <div className="space-y-8">
            <section aria-label="Composición del capital" className="space-y-4">
                <FormSection title="Composición del capital" icon={Layers} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard variant="default" accent="muted" label="Capital suscrito" value={money(partner.partner_total_contributions)} />
                    <StatCard variant="default" accent="muted" label="Capital enterado" value={money(partner.partner_total_paid_in)} />
                    <StatCard variant="default" accent="muted" label="Capital pendiente" value={money(partner.partner_pending_capital)} subtext="Suscrito − enterado" />
                    <StatCard variant="default" accent="muted" label="Exceso de capital" value={money(partner.partner_excess_capital)} subtext={excess ? "Enterado sobre lo suscrito" : "Sin exceso"} />
                </div>
                <PaidInProgress subscribed={Number(partner.partner_total_contributions) || 0} paidIn={Number(partner.partner_total_paid_in) || 0} />
                <PartnerPanelActions actions={actions} label="Acciones de capital" />
            </section>

            <section aria-label="Vigencias de participación" className="space-y-4">
                <FormSection title="Vigencias de participación" icon={History} />
                <StakesTable partnerId={partner.id} />
            </section>

            <section aria-label="Movimientos de capital" className="space-y-4">
                <FormSection title="Movimientos de capital" icon={ArrowRightLeft} />
                <PartnerMovementsTable
                    rows={rows}
                    isLoading={statement.isLoading}
                    isError={statement.isError}
                    refetch={() => void statement.refetch()}
                    emptyTitle="Sin movimientos de capital"
                    emptyDescription="Este socio no tiene suscripciones, aportes, reducciones ni transferencias."
                />
            </section>
        </div>
    )
}
