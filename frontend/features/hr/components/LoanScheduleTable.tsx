"use client"

import { Collection, useEntityCollection } from "@/components/entity-view"
import { loanInstallmentEntity, loanInstallmentViews, type LoanScheduleRow } from "../entity-view/loanInstallment.entity"

interface LoanScheduleTableProps {
    rows: LoanScheduleRow[]
    emptyMessage?: string
}

/** Plan de cuotas de un préstamo: capital, interés y total por período (ADR-0156). */
export function LoanScheduleTable({ rows, emptyMessage = "Calcule las cuotas para ver el plan." }: LoanScheduleTableProps) {
    const collection = useEntityCollection(loanInstallmentEntity, { rows }, { pagination: { mode: "none" } })
    return (
        <Collection.Root collection={collection} label="Plan de cuotas">
            <Collection.View table={loanInstallmentViews.table} emptyTitle={emptyMessage} variant="default" />
        </Collection.Root>
    )
}
