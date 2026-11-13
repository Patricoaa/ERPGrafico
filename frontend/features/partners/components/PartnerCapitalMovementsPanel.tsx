"use client"

import { useMemo } from "react"
import { ArrowRightLeft } from "lucide-react"
import { Section } from "@/components/shared"
import type { Partner } from "@/features/contacts"
import { usePartnerStatement } from "../hooks"
import { isListedMovement } from "../entity-view/partnerMovement.entity"
import { PartnerMovementsTable } from "./PartnerMovementsTable"

/** Pestaña Movimientos de capital: todos los movimientos del socio, del más reciente al más antiguo. */
export function PartnerCapitalMovementsPanel({ partner }: { partner: Partner }) {
    const statement = usePartnerStatement(partner.id)
    const rows = useMemo(() => (statement.data?.transactions ?? [])
        .filter(tx => isListedMovement(tx.transaction_type))
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), [statement.data])

    return (
        <section aria-label="Movimientos de capital" className="space-y-4">
            <Section.Header spaced title="Movimientos de capital" icon={ArrowRightLeft} />
            <PartnerMovementsTable
                rows={rows}
                isLoading={statement.isLoading}
                isError={statement.isError}
                refetch={() => void statement.refetch()}
            />
        </section>
    )
}
