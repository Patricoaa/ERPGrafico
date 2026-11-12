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

/** Pestaña Capital de la ficha: composición del capital, vigencias de participación, movimientos y acciones. */
export function PartnerCapitalPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    const statement = usePartnerStatement(partner.id)
    const rows = useMemo(() => movementsOf(statement.data, isCapitalMovement), [statement.data])
    const actions = partnerActionsFor(partner, "capital", { run })
    const excess = Number(partner.partner_excess_capital) > 0

    return (
        <div className="space-y-8">
            <PartnerPanelActions actions={actions} label="Acciones de capital" />

            <section aria-label="Composición del capital" className="space-y-4">
                <FormSection title="Composición del capital" icon={Layers} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard variant="minimal" accent="muted" label="Capital suscrito" value={money(partner.partner_total_contributions)} />
                    <StatCard variant="minimal" accent="success" label="Capital enterado" value={money(partner.partner_total_paid_in)} />
                    <StatCard variant="minimal" accent="warning" label="Capital pendiente" value={money(partner.partner_pending_capital)} subtext="Suscrito − enterado" />
                    <StatCard variant="minimal" accent="info" label="Exceso de capital" value={money(partner.partner_excess_capital)} subtext={excess ? "Enterado sobre lo suscrito" : "Sin exceso"} />
                </div>
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
