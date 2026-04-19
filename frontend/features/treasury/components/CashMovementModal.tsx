"use client"

import { showApiError } from "@/lib/errors"
import { useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { ArrowLeftRight } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { MovementWizard, MovementData } from "@/features/treasury/components/MovementWizard"

interface CashMovementModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    initialContactId?: number
    initialContactName?: string
    fixedMoveType?: string;
    variant?: 'partners' | 'standard';
}

export function CashMovementModal({ 
    open, 
    onOpenChange, 
    onSuccess,
    initialContactId,
    initialContactName,
    fixedMoveType,
    variant = 'standard'
}: CashMovementModalProps) {
    const handleCompleteWizard = async (data: MovementData) => {
        let movement_type = data.impact === 'TRANSFER' ? 'TRANSFER' : (data.impact === 'IN' ? 'INBOUND' : 'OUTBOUND');

        try {
            await api.post('/treasury/movements/', {
                movement_type: movement_type,
                amount: data.amount,
                from_account: data.fromAccountId || null,
                to_account: data.toAccountId || null,
                contact: data.contactId || null,
                notes: data.notes,
                justify_reason: data.moveType !== 'TRANSFER' ? data.moveType : null,
                payment_method: 'CASH', // Legacy
            })
            toast.success("Movimiento registrado correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            showApiError(error, "Error al registrar movimiento")
            console.error(error)
            throw error // Throw to stop MovementWizard loading state
        }
    }

    return (
        <MovementWizard
            open={open}
            onOpenChange={onOpenChange}
            context="treasury"
            initialContactId={initialContactId}
            initialContactName={initialContactName}
            fixedMoveType={fixedMoveType}
            variant={variant}
            onComplete={handleCompleteWizard}
            onCancel={() => onOpenChange(false)}
        />
    )
}

export default CashMovementModal
