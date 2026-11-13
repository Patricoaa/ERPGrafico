"use client"

import { useMemo } from "react"
import { Layers, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Section } from "@/components/shared"
import type { Partner } from "@/features/contacts"
import { usePartnerStatement } from "../hooks"
import { isListedMovement } from "../entity-view/partnerMovement.entity"
import { partnerActionsFor, TRANSFER_ACTION_LABEL } from "./partnerActions"
import type { PartnerActionRunner } from "./partnerActionRequest"
import { PartnerEquityPanel } from "./PartnerEquityPanel"
import { PartnerMovementsTable } from "./PartnerMovementsTable"

/** Pestaña Capital: composición del patrimonio con la acción de cada línea y todos los movimientos del socio. */
export function PartnerCapitalPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    const statement = usePartnerStatement(partner.id)
    const rows = useMemo(() => (statement.data?.transactions ?? [])
        .filter(tx => isListedMovement(tx.transaction_type))
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), [statement.data])
    const transfer = partnerActionsFor(partner, "capital", { run }).find(a => "label" in a && a.label === TRANSFER_ACTION_LABEL)

    return (
        <div className="space-y-8">
            <section aria-label="Composición del patrimonio" className="space-y-4">
                <Section.Header spaced title="Composición del patrimonio" icon={Layers} />
                <PartnerEquityPanel partner={partner} run={run} />
            </section>

            <section aria-label="Movimientos" className="space-y-4">
                <Section.Header spaced title="Movimientos" icon={ArrowRightLeft} />
                <PartnerMovementsTable
                    rows={rows}
                    isLoading={statement.isLoading}
                    isError={statement.isError}
                    refetch={() => void statement.refetch()}
                    action={transfer && "onClick" in transfer ? (
                        <Button type="button" size="sm" variant="outline" onClick={transfer.onClick}>
                            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                            {TRANSFER_ACTION_LABEL}
                        </Button>
                    ) : undefined}
                />
            </section>
        </div>
    )
}
