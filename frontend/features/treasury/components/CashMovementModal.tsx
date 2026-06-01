"use client"

import { MovementWizard, MovementData } from "@/features/treasury/components/MovementWizard"
import { useTreasuryMovements } from "@/features/treasury/hooks/useTreasuryMovements"

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
    const { createMovement } = useTreasuryMovements()

    const handleCompleteWizard = async (data: MovementData) => {
        const movement_type = data.impact === 'TRANSFER' ? 'TRANSFER' : (data.impact === 'IN' ? 'INBOUND' : 'OUTBOUND');

        try {
            await createMovement({
                movement_type,
                amount: data.amount,
                from_account: data.fromAccountId || null,
                to_account: data.toAccountId || null,
                contact: data.contactId || null,
                notes: data.notes,
                justify_reason: data.moveType !== 'TRANSFER' ? data.moveType : null,
                payment_method: 'CASH',
            })
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error(error)
            throw error
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
