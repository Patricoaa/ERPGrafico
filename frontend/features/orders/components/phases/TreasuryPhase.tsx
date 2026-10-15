"use client"

import { formatCurrency } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Banknote, Trash2, Ban, Gavel } from "lucide-react"
import { formatEntityDisplay } from '@/lib/entity-registry'
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useCancelPayment } from "../../hooks/useOrdersMutations"
import { ActionConfirmModal } from '@/components/shared'
import { AnnulPaymentModal } from "../AnnulPaymentModal"
import { saleOrderActions } from '@/features/sales'
import { purchaseOrderActions } from '@/features/purchasing'
import { type Order, type PhaseDocument, type Payment } from "../../types"

interface TreasuryPhaseProps {
    isNoteMode: boolean
    noteStatuses: Record<string, string | boolean | number>
    activeDoc: Order
    payments: Payment[]
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    posSessionId?: number | null
    isSale?: boolean
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export function TreasuryPhase({
    isNoteMode,
    noteStatuses,
    activeDoc,
    payments,
    userPermissions,
    onActionSuccess,
    openDetails,
    posSessionId,
    isSale = false,
    collapsible,
    isOpen,
    onOpenChange,
}: TreasuryPhaseProps) {
    const registry = isSale ? saleOrderActions : purchaseOrderActions

    const { cancelPayment } = useCancelPayment()

    const [confirmModal, setConfirmModal] = useState<{
        open: boolean,
        title: string,
        description: React.ReactNode,
        onConfirm: (reason?: string) => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string,
        requireReason?: boolean
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const [annulPaymentState, setAnnulPaymentState] = useState<{
        open: boolean
        paymentId: number
        paymentAmount: number
    }>({ open: false, paymentId: 0, paymentAmount: 0 })

    const canCancelPayment = userPermissions.includes('treasury.delete_treasurymovement')

    const handleDeletePayment = (id: number) => {
        const isPosted = payments.find(p => Number(p.id) === id)?.status === 'POSTED'
        if (isPosted) {
            const payment = payments.find(p => Number(p.id) === id)
            setAnnulPaymentState({
                open: true,
                paymentId: id,
                paymentAmount: Number(payment?.amount || 0),
            })
        } else {
            setConfirmModal({
                open: true,
                title: "Cancelar Pago",
                variant: "destructive",
                confirmText: "Cancelar",
                requireReason: false,
                onConfirm: async (reason?: string) => {
                    try {
                        await cancelPayment({ id, reason })
                        setConfirmModal(prev => ({ ...prev, open: false }))
                        onActionSuccess?.()
                    } catch (error: unknown) {
                        toast.error(getErrorMessage(error) || "Error al cancelar el pago")
                        throw error
                    }
                },
                description: "¿Está seguro de que desea cancelar este pago?"
            })
        }
    }

    return (
        <>
            <PhaseCard
                title="Tesorería"
                icon={Banknote}
                variant={
                    (isNoteMode ? noteStatuses.treasury :
                        (parseFloat(String(activeDoc.pending_amount || '0')) <= 0 ? 'success' :
                            (payments.length > 0 ? 'active' : 'neutral'))) as 'success' | 'active' | 'neutral' | 'destructive'
                }
                progress={
                    isNoteMode ? undefined :
                    (() => {
                        const total = parseFloat(String(activeDoc.total || '0'))
                        const pending = parseFloat(String(activeDoc.pending_amount || '0'))
                        return total > 0 ? Math.round(((total - pending) / total) * 100) : 0
                    })()
                }
                documents={payments.map((p: Payment) => {
                    const isWriteOff = p.payment_method === 'WRITE_OFF'
                    return {
                        type: isWriteOff ? 'Castigo' : (p.payment_method_display || 'Pago'),
                        number: p.display_id || formatEntityDisplay('treasury.treasurymovement', { id: p.id }),
                        icon: isWriteOff ? Gavel : Banknote,
                        isWarning: isWriteOff,
                        id: p.id,
                        docType: 'payment',
                        status: p.status || 'Pagado',
                        amount: p.amount,
                        documentReference: p.reference,
                        actions: [
                            ...(canCancelPayment && p.status !== 'CANCELLED' && p.status !== 'POSTED' ? [{
                                icon: Trash2,
                                title: 'Cancelar Pago',
                                color: 'text-destructive hover:bg-destructive/10',
                                onClick: () => p.id && handleDeletePayment(Number(p.id))
                            }] : []),
                            ...(canCancelPayment && p.status === 'POSTED' ? [{
                                icon: Ban,
                                title: 'Anular Pago',
                                color: 'text-warning hover:bg-warning/10',
                                onClick: () => p.id && handleDeletePayment(Number(p.id))
                            }] : [])
                        ]
                    }
                }) as PhaseDocument[]}
                onViewDetail={openDetails}
                actions={(registry.payments?.actions || []).filter((a: { id: string }) => !a.id.includes('view-') && a.id !== 'payment-history')}
                emptyMessage="Sin pagos registrados"
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                stageId="treasury"
                isComplete={parseFloat(String(activeDoc.pending_amount || '0')) <= 0}
                posSessionId={posSessionId}
                collapsible={collapsible}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                <div className="flex items-center justify-between py-2 px-2 border-y border-border/10 my-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-4xs font-bold uppercase tracking-looser text-muted-foreground/50 leading-none">Pagado</span>
                        <span className="text-sm  font-bold text-success tracking-tight">
                            {formatCurrency(Number(activeDoc.total || 0) - Number(activeDoc.pending_amount || 0))}
                        </span>
                    </div>

                    <div className="h-6 w-[1px] bg-border/20 mx-2" />

                    <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-4xs font-bold uppercase tracking-looser text-muted-foreground/50 leading-none">Pendiente</span>
                        <span className={cn(
                            "text-sm  font-bold tracking-tight",
                            parseFloat(String(activeDoc.pending_amount || '0')) > 0 ? "text-warning" : "text-muted-foreground/30"
                        )}>
                            {formatCurrency(Number(activeDoc.pending_amount || 0))}
                        </span>
                    </div>
                </div>
                
            </PhaseCard>

            <ActionConfirmModal
                open={confirmModal.open}
                onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
                requireReason={confirmModal.requireReason}
                reasonLabel="Motivo de la anulación"
            />

            {/* Anular pago POSTED — modal con selector de cuenta + motivo */}
            {annulPaymentState.open && (
                <AnnulPaymentModal
                    key={annulPaymentState.paymentId}
                    open
                    onOpenChange={(open) => setAnnulPaymentState(prev => ({ ...prev, open }))}
                    paymentId={annulPaymentState.paymentId}
                    paymentAmount={annulPaymentState.paymentAmount}
                    isSale={isSale}
                    onSuccess={onActionSuccess}
                />
            )}
        </>
    )
}
