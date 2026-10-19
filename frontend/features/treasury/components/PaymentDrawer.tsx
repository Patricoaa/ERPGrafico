"use client"

import { useState, useEffect } from "react"
import { useDrawerMode } from "@/features/_shared/drawer/useDrawerMode"
import { PaymentSheet } from "./PaymentSheet"
import { PaymentFormDrawer } from "./PaymentFormDrawer"
import type { PaymentInitialData } from "@/types/forms"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { usePayment } from "@/features/treasury/hooks/usePayment"

/**
 * Wrapper fino para PaymentDrawer que delega a:
 * - PaymentSheet (modo view) — ficha documental canónica
 * - PaymentFormDrawer (modo create/edit) — formulario CRUD
 *
 * Mantiene compatibilidad con ENTITY_DRAWERS registry.
 */
export interface PaymentDrawerProps {
    onSuccess?: () => void
    initialData?: PaymentInitialData
    triggerText?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: DrawerMode
    paymentId?: number
    id?: number | null
}

export function PaymentDrawer({
    onSuccess,
    initialData,
    triggerText = "Registrar Pago",
    open: openProp,
    onOpenChange,
    inline = false,
    onLoadingChange,
    mode: modeProp,
    paymentId,
    id,
}: PaymentDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const entityId = paymentId ?? id ?? initialData?.id ?? null

    // Fetch entry data when we have an ID but no initialData (for ENTITY_DRAWERS)
    const { data: fetchedPayment, isLoading: isFetching } = usePayment(
        entityId && !initialData ? entityId : null
    )

    // Derive mode using canonical hook
    const { mode, isView } = useDrawerMode({
        mode: modeProp,
        initialData: initialData ?? (fetchedPayment as PaymentInitialData | undefined),
    })

    // Sync loading state
    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isFetching)
        }
    }, [isFetching, onLoadingChange])

    // Show skeleton while fetching for view mode
    if (isView && entityId && isFetching) {
        return <PaymentSheet id={entityId} open={open} onOpenChange={setOpen} onActionSuccess={onSuccess} />
    }

    // Delegate based on mode
    if (isView) {
        return (
            <PaymentSheet
                id={entityId}
                open={open}
                onOpenChange={setOpen}
                onActionSuccess={onSuccess}
            />
        )
    }

    return (
        <PaymentFormDrawer
            onSuccess={onSuccess}
            initialData={initialData ?? (fetchedPayment as PaymentInitialData | undefined)}
            triggerText={triggerText}
            open={open}
            onOpenChange={setOpen}
            inline={inline}
            onLoadingChange={onLoadingChange}
            mode={mode}
            paymentId={paymentId}
        />
    )
}