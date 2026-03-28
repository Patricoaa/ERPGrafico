"use client"

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
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar movimiento")
            console.error(error)
            throw error // Throw to stop MovementWizard loading state
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <ArrowLeftRight className="h-5 w-5 text-primary" />
                    </div>
                    <span>Nuevo Movimiento de Tesorería</span>
                </div>
            }
            description={variant === 'partners' 
                ? "Registre aportes o retiros de capital societario en efectivo."
                : "Registre traspasos, depósitos o retiros manuales de socios o generales."
            }
            size="md"
        >
            <div className="pt-2 pb-6">
                {open && (
                    <MovementWizard
                        context="treasury"
                        initialContactId={initialContactId}
                        initialContactName={initialContactName}
                        fixedMoveType={fixedMoveType}
                        variant={variant}
                        onComplete={handleCompleteWizard}
                        onCancel={() => onOpenChange(false)}
                    />
                )}
            </div>
        </BaseModal>
    )
}

export default CashMovementModal
