"use client"

import { useTaxPeriods } from "../hooks/useTaxQueries"
import type { TaxPeriod } from "../types"
import { DeclarationWizard } from "./DeclarationWizard"

interface DeclarationRecordWizardProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Wizard F29 de un período como pestaña propia (ADR-0152). El wizard sigue abierto mientras el usuario
 * registra o paga; al salir refresca los períodos, como en la página.
 */
export function DeclarationRecordWizard({ id, open, onOpenChange, onSuccess }: DeclarationRecordWizardProps) {
    const { taxPeriods, refetch } = useTaxPeriods()
    const periods = ((taxPeriods as { results?: TaxPeriod[] } | null)?.results ?? []) as TaxPeriod[]
    return (
        <DeclarationWizard
            isOpen={open}
            onOpenChange={(next) => {
                if (next) return
                void refetch()
                onOpenChange(false)
            }}
            periodId={id}
            onSuccess={() => {
                void refetch()
                onSuccess?.()
            }}
            existingPeriods={periods}
        />
    )
}
