"use client"

import { BankStatementSheet } from "./BankStatementSheet"

/**
 * Entrada del registro de entidades (`ENTITY_DRAWERS["treasury.bankstatement"]`): delega en la
 * ficha documental `BankStatementSheet`, que es la única superficie de la cartola.
 */
export interface BankStatementDrawerProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function BankStatementDrawer({ statementId, open, onOpenChange, onSuccess }: BankStatementDrawerProps) {
    return (
        <BankStatementSheet
            id={statementId}
            open={open}
            onOpenChange={onOpenChange}
            onActionSuccess={onSuccess}
        />
    )
}
