"use client"

import { useState, useEffect } from "react"
import { BankStatementSheet } from "./BankStatementSheet"
import { useBankStatement } from "../hooks/useBankStatement"
import { useDrawerIdentity } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"

/**
 * Wrapper para BankStatementDrawer que delega a BankStatementSheet (modo view).
 * Mantiene compatibilidad con ENTITY_DRAWERS registry.
 */
export interface BankStatementDrawerProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function BankStatementDrawer({ statementId, open, onOpenChange, onSuccess }: BankStatementDrawerProps) {
    const { statement, isLoading, isError } = useBankStatement(statementId, open)

    // Show skeleton while fetching
    if (statementId && isLoading) {
        return <BankStatementSheet id={statementId} open={open} onOpenChange={onOpenChange} onActionSuccess={onSuccess} />
    }

    return (
        <BankStatementSheet
            id={statementId}
            open={open}
            onOpenChange={onOpenChange}
            onActionSuccess={onSuccess}
        />
    )
}