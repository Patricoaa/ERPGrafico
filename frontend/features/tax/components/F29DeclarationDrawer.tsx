"use client"

import { useState, useEffect } from "react"
import { F29DeclarationSheet } from "./F29DeclarationSheet"
import { useF29Detail } from "../hooks/useTaxQueries"

/**
 * Wrapper para F29DeclarationDrawer que delega a F29DeclarationSheet (modo view).
 * Mantiene compatibilidad con ENTITY_DRAWERS registry.
 */
export interface F29DeclarationDrawerProps {
    declarationId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function F29DeclarationDrawer({ declarationId, open, onOpenChange, onSuccess }: F29DeclarationDrawerProps) {
    const { f29Detail: declaration, isLoading, isError } = useF29Detail(declarationId ?? undefined)

    // Show skeleton while fetching
    if (declarationId && isLoading) {
        return <F29DeclarationSheet id={declarationId} open={open} onOpenChange={onOpenChange} onActionSuccess={onSuccess} />
    }

    return (
        <F29DeclarationSheet
            id={declarationId}
            open={open}
            onOpenChange={onOpenChange}
            onActionSuccess={onSuccess}
        />
    )
}