"use client"

import { useMemo, useState } from "react"
import { Coins, ArrowRightLeft } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { FormSection, StatCard } from "@/components/shared"
import type { Partner } from "@/features/contacts"
import { usePartnerStatement } from "../hooks"
import { isResultsMovement } from "../entity-view/partnerMovement.entity"
import { partnerActionsFor } from "./partnerActions"
import type { PartnerActionRunner } from "./partnerActionRequest"
import { PartnerPanelActions } from "./PartnerPanelActions"
import { PartnerMovementsTable } from "./PartnerMovementsTable"
import { movementsOf } from "./movementRows"

const money = (v: string | number | null | undefined) => formatCurrency(Number(v) || 0)

const FILTERS: { key: string; label: string; types: string[] | null }[] = [
    { key: "all", label: "Todos", types: null },
    { key: "withdrawals", label: "Retiros", types: ["PROV_WITHDRAWAL", "WITHDRAWAL"] },
    { key: "dividends", label: "Dividendos", types: ["DIVIDEND", "DIVIDEND_PAY"] },
    { key: "retained", label: "Utilidades retenidas", types: ["RETAINED", "RETAINED_MOB"] },
]

/** Pestaña Resultados de la ficha: saldos, movimientos de retiro/dividendo/utilidad retenida y acciones. */
export function PartnerResultsPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    const statement = usePartnerStatement(partner.id)
    const [filterKey, setFilterKey] = useState("all")
    const types = FILTERS.find(f => f.key === filterKey)?.types ?? null
    const rows = useMemo(
        () => movementsOf(statement.data, t => isResultsMovement(t) && (!types || types.includes(t))),
        [statement.data, types],
    )
    const actions = partnerActionsFor(partner, "results", { run })

    return (
        <div className="space-y-8">
            <section aria-label="Saldos de resultados" className="space-y-4">
                <FormSection title="Saldos" icon={Coins} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard variant="default" accent="muted" label="Retiros provisorios" value={money(partner.partner_provisional_withdrawals_balance)} />
                    <StatCard variant="default" accent="muted" label="Utilidades retenidas" value={money(partner.partner_earnings_balance)} />
                    <StatCard variant="default" accent="muted" label="Dividendos por pagar" value={money(partner.partner_dividends_payable_balance)} />
                </div>
                <PartnerPanelActions actions={actions} label="Acciones de resultados" />
            </section>

            <section aria-label="Movimientos de resultados" className="space-y-4">
                <FormSection title="Movimientos de resultados" icon={ArrowRightLeft} />
                <PartnerMovementsTable
                    rows={rows}
                    isLoading={statement.isLoading}
                    isError={statement.isError}
                    refetch={() => void statement.refetch()}
                    emptyTitle="Sin movimientos de resultados"
                    emptyDescription="Este socio no tiene retiros, dividendos ni utilidades retenidas."
                    toolbar={
                        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
                            {FILTERS.map(f => (
                                <Button key={f.key} type="button" size="sm" variant={f.key === filterKey ? "secondary" : "outline"} aria-pressed={f.key === filterKey} onClick={() => setFilterKey(f.key)}>
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                    }
                />
            </section>
        </div>
    )
}
