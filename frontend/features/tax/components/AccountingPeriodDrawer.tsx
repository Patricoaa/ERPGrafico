"use client"

import { useState, useEffect } from "react"
import { AccountingPeriodSheet } from "./AccountingPeriodSheet"
import { useTaxPeriod } from "../hooks/useTaxQueries"

/**
 * Wrapper para AccountingPeriodDrawer que delega a AccountingPeriodSheet (modo view).
 * Mantiene compatibilidad con ENTITY_DRAWERS registry.
 */
export interface AccountingPeriodDrawerProps {
    periodId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function AccountingPeriodDrawer({ periodId, open, onOpenChange, onSuccess }: AccountingPeriodDrawerProps) {
    const { taxPeriod: period, isLoading, isError } = useTaxPeriod(periodId ?? undefined)

    // Show skeleton while fetching
    if (periodId && isLoading) {
        return <AccountingPeriodSheet id={periodId} open={open} onOpenChange={onOpenChange} onActionSuccess={onSuccess} />
    }

    return (
        <AccountingPeriodSheet
            id={periodId}
            open={open}
            onOpenChange={onOpenChange}
            onActionSuccess={onSuccess}
        />
    )
}