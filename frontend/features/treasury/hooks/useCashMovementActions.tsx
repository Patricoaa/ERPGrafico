"use client"

import { useState, type ReactNode } from "react"
import { Ban, Trash2, RotateCcw } from "lucide-react"
import { showApiError } from "@/lib/errors"
import { ActionConfirmModal, type DocumentActionItem } from "@/components/shared"
import type { DocumentLink } from "@/features/documents"
import { AnnulPaymentModal, useCancelPayment, useCancelInvoice } from "@/features/orders"
import { useAuth } from "@/contexts/AuthContext"
import type { TreasuryMovement } from "../types"

interface UseCashMovementActionsOptions {
    movement: TreasuryMovement | null | undefined
    onSuccess?: () => void
}

interface AnnulState {
    id: number
    amount: number
    mode: 'annul' | 'return'
}

interface ConfirmState {
    title: string
    description: ReactNode
    onConfirm: (reason?: string) => Promise<void>
    variant: "destructive" | "warning"
    confirmText: string
    requireReason?: boolean
}

/**
 * Acciones del kebab y de documentos relacionados para CashMovementDrawer (ADR-0083):
 * - Kebab: anular pago (POSTED), cancelar pago (DRAFT), devolver pago (POSTED INBOUND)
 * - rowActions: cancelar borrador de factura relacionada
 */
export function useCashMovementActions({ movement, onSuccess }: UseCashMovementActionsOptions) {
    const { user } = useAuth()
    const permissions: string[] = user?.permissions ?? []
    const { cancelPayment } = useCancelPayment()
    const { cancelInvoice } = useCancelInvoice()

    const [annulState, setAnnulState] = useState<AnnulState | null>(null)
    const [confirm, setConfirm] = useState<ConfirmState | null>(null)

    const can = (perm: string) => permissions.includes(perm)
    const close = () => setConfirm(null)

    const confirmThen = (
        state: Omit<ConfirmState, 'onConfirm'>,
        run: (reason?: string) => Promise<unknown>,
        errorLabel: string,
    ) => {
        setConfirm({
            ...state,
            onConfirm: async (reason?: string) => {
                try {
                    await run(reason)
                    close()
                    onSuccess?.()
                } catch (error: unknown) {
                    showApiError(error, errorLabel)
                    throw error
                }
            },
        })
    }

    // ── Kebab actions for the movement itself ─────────────────────────────────
    const actions: DocumentActionItem[] = []
    const status = movement?.status ?? ''

    // Movement statuses from serializer: POSTED, PENDING, RECONCILED (no DRAFT)
    const canModify = status !== 'RECONCILED' && can('treasury.delete_treasurymovement')

    if (canModify) {
        if (status === 'POSTED') {
            actions.push({
                id: 'annul-payment',
                label: 'Anular pago',
                icon: Ban,
                destructive: true,
                onClick: () => setAnnulState({ id: movement!.id, amount: Number(movement!.amount), mode: 'annul' }),
            })
        }
        actions.push({
            id: 'cancel-payment',
            label: 'Cancelar pago',
            icon: Trash2,
            destructive: true,
            onClick: () => confirmThen(
                {
                    title: "Cancelar Pago",
                    variant: "destructive",
                    confirmText: "Cancelar",
                    description: "¿Está seguro de que desea cancelar este pago? Esta acción elimina el registro sin crear un asiento de reversión.",
                },
                (reason) => cancelPayment({ id: movement!.id, reason }),
                "Error al cancelar el pago",
            ),
        })
    }

    if (status === 'POSTED' && movement?.movement_type === 'INBOUND' && can('treasury.add_treasurymovement')) {
        actions.push({
            id: 'return-payment',
            label: 'Devolver pago',
            icon: RotateCcw,
            onClick: () => setAnnulState({ id: movement!.id, amount: Number(movement!.amount), mode: 'return' }),
        })
    }

    // ── Row actions for related documents ────────────────────────────────────
    const rowActions = (link: DocumentLink): DocumentActionItem[] => {
        const { label, id, status: linkStatus, accessible } = link.target
        if (!accessible || linkStatus === 'CANCELLED') return []

        if (label === 'billing.invoice' && linkStatus === 'DRAFT' && can('billing.delete_invoice')) {
            return [{
                id: 'cancel-draft-invoice',
                label: 'Cancelar borrador',
                icon: Trash2,
                destructive: true,
                onClick: () => confirmThen(
                    {
                        title: "Cancelar Borrador",
                        variant: "destructive",
                        confirmText: "Cancelar Borrador",
                        description: "¿Estás seguro de que deseas cancelar este borrador de factura?",
                    },
                    (reason) => cancelInvoice({ id, reason }),
                    "No se pudo cancelar el borrador",
                ),
            }]
        }

        return []
    }

    const host: ReactNode = (
        <>
            <ActionConfirmModal
                open={!!confirm}
                onOpenChange={(open) => { if (!open) close() }}
                title={confirm?.title ?? ""}
                description={confirm?.description}
                onConfirm={confirm?.onConfirm ?? (() => undefined)}
                variant={confirm?.variant}
                confirmText={confirm?.confirmText}
                requireReason={confirm?.requireReason}
                reasonLabel="Motivo"
            />
            {annulState && (
                <AnnulPaymentModal
                    key={`${annulState.id}-${annulState.mode}`}
                    open
                    onOpenChange={(open) => { if (!open) setAnnulState(null) }}
                    paymentId={annulState.id}
                    paymentAmount={annulState.amount}
                    isSale={false}
                    mode={annulState.mode}
                    onSuccess={() => { setAnnulState(null); onSuccess?.() }}
                />
            )}
        </>
    )

    return { actions, rowActions, host }
}
