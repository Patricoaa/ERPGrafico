"use client"

import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { LoanViewDrawer } from "./LoanViewDrawer"

interface LoanRecordDrawerProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Detalle de un crédito como pestaña propia (ADR-0152). Desembolsar es una acción sobre el crédito: la
 * pestaña de página `?selected&action=disburse` (variant `disburse`) la atiende, así que aquí solo se
 * pide abrirla.
 */
export function LoanRecordDrawer({ id, open, onOpenChange }: LoanRecordDrawerProps) {
    const { openAction } = useEntityRouteActions()
    return <LoanViewDrawer loanId={id} open={open} onOpenChange={onOpenChange} onDisburse={(loan) => openAction(loan.id, "disburse")} />
}
